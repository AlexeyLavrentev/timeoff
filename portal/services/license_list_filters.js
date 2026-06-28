'use strict';

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const SCAN_CAP = 5000;
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

const singleValue = (v) => {
  if (Array.isArray(v)) return (v[0] || '').trim().substring(0, 128);
  return typeof v === 'string' ? v.trim().substring(0, 128) : '';
};

const sanitizeLike = (v) => v.replace(/[%_]/g, '');

const parseSeatsFilter = (raw) => {
  if (!raw) return { provided: false, value: null, invalid: false };
  const trimmed = String(raw).trim();
  if (!trimmed) return { provided: false, value: null, invalid: false };
  if (!/^\d+$/.test(trimmed)) return { provided: true, value: null, invalid: true };
  const n = Number(trimmed);
  if (n < 1 || n > 1000000) return { provided: true, value: null, invalid: true };
  return { provided: true, value: n, invalid: false };
};

const normalizeDomainFilter = (raw) => {
  const d = String(raw || '').trim().toLowerCase();
  if (!d) return { provided: false, value: null, invalid: false };
  if (d.length > 253) return { provided: true, value: null, invalid: true };
  if (d.includes('://') || d.includes('/') || d.includes('@') || d.includes('*') || d.includes(' ')) {
    return { provided: true, value: null, invalid: true };
  }
  if (!DOMAIN_RE.test(d)) return { provided: true, value: null, invalid: true };
  return { provided: true, value: d, invalid: false };
};

const parsePagination = (raw) => {
  const pageRaw = singleValue(raw.page);
  const perPageRaw = singleValue(raw.perPage);
  const page = /^\d+$/.test(pageRaw) ? Math.max(1, Number(pageRaw)) : 1;
  const perPage = /^\d+$/.test(perPageRaw) ? Math.min(MAX_PER_PAGE, Math.max(1, Number(perPageRaw))) : DEFAULT_PER_PAGE;
  return { page, perPage, offset: (page - 1) * perPage };
};

const buildFilterState = (query) => {
  const customerFilter = singleValue(query.customer);
  const planFilter = singleValue(query.plan);
  const qFilter = singleValue(query.q);

  const VALID_STATUSES = ['all', 'active', 'expired'];
  const rawStatus = singleValue(query.status);
  const statusFilter = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'all';

  const externalIdRaw = singleValue(query.externalCustomerId);
  const externalIdLike = externalIdRaw ? sanitizeLike(externalIdRaw) : null;

  const domainFilter = singleValue(query.domain);
  const { provided: domainProvided, value: domainLike, invalid: domainInvalid } = normalizeDomainFilter(domainFilter);

  const minSeatsRaw = singleValue(query.minSeats);
  const maxSeatsRaw = singleValue(query.maxSeats);
  const { provided: minSeatsProvided, value: minSeats, invalid: minSeatsInvalid } = parseSeatsFilter(minSeatsRaw);
  const { provided: maxSeatsProvided, value: maxSeats, invalid: maxSeatsInvalid } = parseSeatsFilter(maxSeatsRaw);

  const externalIdFilter = externalIdLike || null;

  const VALID_ISSUE_REASONS = ['new', 'renewal', 'replacement', 'correction', 'trial', 'other'];
  const issueReasonRaw = singleValue(query.issueReason);
  const issueReasonFilter = issueReasonRaw && VALID_ISSUE_REASONS.includes(issueReasonRaw) ? issueReasonRaw : null;
  const issueReasonInvalid = issueReasonRaw && !issueReasonFilter;

  const hasInvalidMetaFilter = domainInvalid || minSeatsInvalid || maxSeatsInvalid
    || issueReasonInvalid
    || (minSeats && maxSeats && minSeats > maxSeats)
    || (externalIdRaw && !externalIdLike);

  const needsMetadataFilter = externalIdFilter || domainProvided || minSeatsProvided || maxSeatsProvided || issueReasonFilter;

  const customerLike = sanitizeLike(customerFilter);
  const qLike = sanitizeLike(qFilter);

  return {
    customerFilter,
    planFilter,
    qFilter,
    statusFilter,
    externalIdFilter,
    domainLike,
    domainProvided,
    minSeats,
    maxSeats,
    minSeatsRaw,
    maxSeatsRaw,
    hasInvalidMetaFilter,
    needsMetadataFilter,
    issueReasonFilter,
    issueReasonRaw,
    customerLike,
    qLike,
    hasActiveFilters: !!(customerFilter || planFilter || statusFilter !== 'all' || qFilter || externalIdRaw || domainFilter || minSeatsRaw || maxSeatsRaw || issueReasonRaw),
  };
};

const buildDbFilters = (filters) => {
  const { Op } = require('sequelize');
  const where = {};
  const customerWhere = {};
  const planWhere = {};

  if (filters.customerFilter && filters.customerLike) {
    customerWhere.name = { [Op.like]: '%' + filters.customerLike + '%' };
  } else if (filters.customerFilter && !filters.customerLike) {
    customerWhere.id = { [Op.in]: [] };
  }

  if (filters.planFilter) {
    planWhere.name = filters.planFilter;
  }

  if (filters.statusFilter === 'active') {
    where[Op.or] = [
      { expiresAt: { [Op.is]: null } },
      { expiresAt: { [Op.gte]: new Date() } },
    ];
  } else if (filters.statusFilter === 'expired') {
    where.expiresAt = { [Op.lt]: new Date() };
  }

  if (filters.qFilter && filters.qLike) {
    const qConditions = [
      { payloadHash: { [Op.like]: filters.qLike + '%' } },
      { licenseHash: { [Op.like]: filters.qLike + '%' } },
      { '$customer.name$': { [Op.like]: '%' + filters.qLike + '%' } },
      { '$plan.name$': { [Op.like]: '%' + filters.qLike + '%' } },
    ];

    if (where[Op.or]) {
      where[Op.and] = [
        { [Op.or]: where[Op.or] },
        { [Op.or]: qConditions },
      ];
      delete where[Op.or];
    } else {
      where[Op.or] = qConditions;
    }
  } else if (filters.qFilter && !filters.qLike) {
    where.id = { [Op.in]: [] };
  }

  return { where, customerWhere, planWhere };
};

const licenseMatchesMetadataFilters = (license, filters) => {
  const m = license.metadata || {};

  if (filters.externalIdFilter) {
    const eid = String(m.externalCustomerId || '').toLowerCase();
    if (!eid.includes(filters.externalIdFilter.toLowerCase())) return false;
  }

  if (filters.domainLike) {
    const domains = m.customerDomains || [];
    if (!domains.some(d => d === filters.domainLike)) return false;
  }

  if (filters.minSeats) {
    if (!m.seats || m.seats < filters.minSeats) return false;
  }

  if (filters.maxSeats) {
    if (!m.seats || m.seats > filters.maxSeats) return false;
  }

  if (filters.issueReasonFilter) {
    if (m.issueReason !== filters.issueReasonFilter) return false;
  }

  return true;
};

module.exports = {
  singleValue,
  sanitizeLike,
  parseSeatsFilter,
  normalizeDomainFilter,
  parsePagination,
  buildFilterState,
  buildDbFilters,
  licenseMatchesMetadataFilters,
  SCAN_CAP,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  DOMAIN_RE,
};

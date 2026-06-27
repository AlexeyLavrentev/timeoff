'use strict';

const MAX_DOMAINS = 20;
const MAX_DOMAIN_LENGTH = 253;
const MAX_EXTERNAL_ID_LENGTH = 128;
const MAX_NOTES_LENGTH = 1000;
const MAX_SEATS = 1000000;

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

const validateSeats = (seats) => {
  if (seats === null || seats === undefined || seats === '') return null;
  const n = Number(seats);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SEATS) {
    return 'seats must be an integer between 1 and ' + MAX_SEATS;
  }
  return null;
};

const validateDomains = (raw) => {
  if (!raw) return { value: null, error: null };
  const text = String(raw);
  const parts = text.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);

  if (parts.length > MAX_DOMAINS) {
    return { value: null, error: 'maximum ' + MAX_DOMAINS + ' domains allowed' };
  }

  const cleaned = [];
  const seen = new Set();

  for (const part of parts) {
    if (part.includes('://') || part.includes('/') || part.includes(' ') || part.includes('@') || part.includes('*')) {
      return { value: null, error: 'invalid domain: ' + part };
    }

    if (part.length > MAX_DOMAIN_LENGTH) {
      return { value: null, error: 'domain too long: ' + part.substring(0, 30) + '…' };
    }

    if (!DOMAIN_RE.test(part)) {
      return { value: null, error: 'invalid domain format: ' + part };
    }

    if (!seen.has(part)) {
      seen.add(part);
      cleaned.push(part);
    }
  }

  return { value: cleaned.length > 0 ? cleaned : null, error: null };
};

const validateExternalCustomerId = (value) => {
  if (!value) return { value: null, error: null };
  const trimmed = String(value).trim();
  if (!trimmed) return { value: null, error: null };
  if (trimmed.length > MAX_EXTERNAL_ID_LENGTH) {
    return { value: null, error: 'externalCustomerId must be at most ' + MAX_EXTERNAL_ID_LENGTH + ' characters' };
  }
  if (/[<>]/.test(trimmed)) {
    return { value: null, error: 'externalCustomerId must not contain < or > characters' };
  }
  return { value: trimmed, error: null };
};

const validateOperatorNotes = (value) => {
  if (!value) return { value: null, error: null };
  const trimmed = String(value).trim();
  if (!trimmed) return { value: null, error: null };
  if (trimmed.length > MAX_NOTES_LENGTH) {
    return { value: null, error: 'operatorNotes must be at most ' + MAX_NOTES_LENGTH + ' characters' };
  }
  return { value: trimmed, error: null };
};

const validateMetadata = (input) => {
  if (!input || typeof input !== 'object') return { metadata: null, errors: [] };

  const errors = [];
  const metadata = {};

  if (input.seats !== undefined && input.seats !== null && input.seats !== '') {
    const seatsErr = validateSeats(input.seats);
    if (seatsErr) errors.push(seatsErr);
    else metadata.seats = Number(input.seats);
  }

  if (input.customerDomains) {
    const { value, error } = validateDomains(input.customerDomains);
    if (error) errors.push(error);
    else if (value) metadata.customerDomains = value;
  }

  if (input.externalCustomerId) {
    const { value, error } = validateExternalCustomerId(input.externalCustomerId);
    if (error) errors.push(error);
    else if (value) metadata.externalCustomerId = value;
  }

  if (input.operatorNotes) {
    const { value, error } = validateOperatorNotes(input.operatorNotes);
    if (error) errors.push(error);
    else if (value) metadata.operatorNotes = value;
  }

  return {
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    errors,
  };
};

module.exports = {
  validateMetadata,
  validateSeats,
  validateDomains,
  validateExternalCustomerId,
  validateOperatorNotes,
  MAX_DOMAINS,
  MAX_DOMAIN_LENGTH,
  MAX_EXTERNAL_ID_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_SEATS,
};

'use strict';

const crypto = require('crypto');
const expect = require('chai').expect;
const { validateMetadata, validateSeats, validateDomains } = require('../../../portal/services/license_metadata');

describe('License metadata validation', function() {
  describe('seats', function() {
    it('valid seats accepted', function() {
      expect(validateSeats(25)).to.be.null;
      expect(validateSeats(1)).to.be.null;
      expect(validateSeats(1000000)).to.be.null;
    });

    it('seats 0 rejected', function() {
      expect(validateSeats(0)).to.be.a('string');
    });

    it('negative seats rejected', function() {
      expect(validateSeats(-1)).to.be.a('string');
    });

    it('non-integer seats rejected', function() {
      expect(validateSeats(1.5)).to.be.a('string');
      expect(validateSeats('abc')).to.be.a('string');
    });

    it('too-large seats rejected', function() {
      expect(validateSeats(1000001)).to.be.a('string');
    });

    it('null/undefined/empty allowed', function() {
      expect(validateSeats(null)).to.be.null;
      expect(validateSeats(undefined)).to.be.null;
      expect(validateSeats('')).to.be.null;
    });
  });

  describe('domains', function() {
    it('valid domains accepted and normalized', function() {
      const result = validateDomains('Example.COM\nSub.example.org');
      expect(result.error).to.be.null;
      expect(result.value).to.deep.equal(['example.com', 'sub.example.org']);
    });

    it('comma separated domains accepted', function() {
      const result = validateDomains('a.com, b.com, c.com');
      expect(result.error).to.be.null;
      expect(result.value).to.deep.equal(['a.com', 'b.com', 'c.com']);
    });

    it('duplicate domains deduplicated', function() {
      const result = validateDomains('a.com\na.com\nb.com');
      expect(result.error).to.be.null;
      expect(result.value).to.deep.equal(['a.com', 'b.com']);
    });

    it('domain with https:// rejected', function() {
      expect(validateDomains('https://example.com').error).to.be.a('string');
    });

    it('domain with path rejected', function() {
      expect(validateDomains('example.com/path').error).to.be.a('string');
    });

    it('email rejected', function() {
      expect(validateDomains('user@example.com').error).to.be.a('string');
    });

    it('wildcard rejected', function() {
      expect(validateDomains('*.example.com').error).to.be.a('string');
    });

    it('space in domain rejected', function() {
      expect(validateDomains('exam ple.com').error).to.be.a('string');
    });

    it('empty/null returns null', function() {
      expect(validateDomains(null).value).to.be.null;
      expect(validateDomains('').value).to.be.null;
    });
  });

  describe('validateMetadata', function() {
    it('returns null metadata for empty input', function() {
      const result = validateMetadata({});
      expect(result.metadata).to.be.null;
      expect(result.errors).to.deep.equal([]);
    });

    it('valid metadata accepted', function() {
      const result = validateMetadata({
        seats: 10,
        customerDomains: 'a.com',
        externalCustomerId: 'CRM-1',
        operatorNotes: 'note',
      });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.seats).to.equal(10);
      expect(result.metadata.customerDomains).to.deep.equal(['a.com']);
      expect(result.metadata.externalCustomerId).to.equal('CRM-1');
      expect(result.metadata.operatorNotes).to.equal('note');
    });

    it('returns errors for invalid seats', function() {
      const result = validateMetadata({ seats: -5 });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('seats');
    });

    it('returns errors for invalid domains', function() {
      const result = validateMetadata({ customerDomains: 'https://bad.com' });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('invalid');
    });
  });

  describe('externalCustomerId', function() {
    it('accepts up to 128 characters', function() {
      const long = 'a'.repeat(128);
      const result = validateMetadata({ externalCustomerId: long });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.externalCustomerId).to.equal(long);
    });

    it('rejects 129 characters', function() {
      const tooLong = 'a'.repeat(129);
      const result = validateMetadata({ externalCustomerId: tooLong });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('128');
    });

    it('rejects HTML-like values', function() {
      const result = validateMetadata({ externalCustomerId: '<script>alert(1)</script>' });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('< or >');
    });

    it('trims whitespace', function() {
      const result = validateMetadata({ externalCustomerId: '  CRM-1  ' });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.externalCustomerId).to.equal('CRM-1');
    });

    it('empty after trim returns null', function() {
      const result = validateMetadata({ externalCustomerId: '   ' });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata).to.be.null;
    });
  });

  describe('operatorNotes', function() {
    it('accepts up to 1000 characters', function() {
      const long = 'a'.repeat(1000);
      const result = validateMetadata({ operatorNotes: long });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.operatorNotes).to.equal(long);
    });

    it('rejects 1001 characters', function() {
      const tooLong = 'a'.repeat(1001);
      const result = validateMetadata({ operatorNotes: tooLong });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('1000');
    });

    it('trims whitespace', function() {
      const result = validateMetadata({ operatorNotes: '  note  ' });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.operatorNotes).to.equal('note');
    });
  });
});

describe('Portal metadata migration', function() {
  const { loadPortalModels } = require('../../../portal/models');
  const { runPortalMigrations } = require('../../../portal/migrator');

  it('adds metadata column to old schema', async function() {
    const models = loadPortalModels({ storage: ':memory:' });
    await models.sequelize.sync();

    await models.sequelize.getQueryInterface().removeColumn('licenses', 'metadata');

    const result = await runPortalMigrations(models);
    expect(result).to.include('002-license-metadata.js');

    const desc = await models.sequelize.getQueryInterface().describeTable('licenses');
    expect(desc.metadata).to.not.be.undefined;

    await models.sequelize.close();
  });

  it('is idempotent on second run', async function() {
    const models = loadPortalModels({ storage: ':memory:' });
    await models.sequelize.sync();

    const r1 = await runPortalMigrations(models);
    const r2 = await runPortalMigrations(models);
    expect(r1).to.include('001-initial-schema.js');
    expect(r2).to.deep.equal([]);

    await models.sequelize.close();
  });

  it('issue license with metadata succeeds on upgraded DB', async function() {
    const models = loadPortalModels({ storage: ':memory:' });
    await models.sequelize.sync();
    await models.sequelize.getQueryInterface().removeColumn('licenses', 'metadata');
    await runPortalMigrations(models);

    const { seedPlans } = require('../../../portal/seeders/seed_plans');
    const { FileSigningProvider } = require('../../../portal/signing/file_signing_provider');
    const { issueLicense } = require('../../../portal/services/license_service');
    const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sp = new FileSigningProvider({
      privateKeyPem: kp.privateKey.export({ type: 'pkcs1', format: 'pem' }),
      publicKeyPem: kp.publicKey.export({ type: 'pkcs1', format: 'pem' }),
    });

    await seedPlans(models.Plan);
    const c = await models.Customer.create({ name: 'UpgradeTest' });
    const p = await models.Plan.findOne({ where: { name: 'pro' } });

    const result = await issueLicense(models, sp, {
      customerId: c.id,
      planId: p.id,
      actorName: 'test',
      metadata: { seats: 42 },
    });

    const lic = await models.License.findByPk(result.license.id);
    expect(lic.metadata).to.deep.equal({ seats: 42 });

    await models.sequelize.close();
  });
});

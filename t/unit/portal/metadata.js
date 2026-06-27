'use strict';

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
});

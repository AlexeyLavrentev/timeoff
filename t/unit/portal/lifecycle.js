'use strict';

const expect = require('chai').expect;
const { validateMetadata, VALID_ISSUE_REASONS } = require('../../../portal/services/license_metadata');

describe('License lifecycle metadata', function() {
  describe('issueReason', function() {
    it('valid issueReason accepted', function() {
      for (const reason of VALID_ISSUE_REASONS) {
        const result = validateMetadata({ issueReason: reason });
        expect(result.errors).to.deep.equal([]);
        expect(result.metadata.issueReason).to.equal(reason);
      }
    });

    it('invalid issueReason rejected', function() {
      const result = validateMetadata({ issueReason: 'badreason' });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('issueReason');
    });

    it('empty issueReason accepted', function() {
      const result = validateMetadata({ issueReason: '' });
      expect(result.errors).to.deep.equal([]);
    });
  });

  describe('replacementOfLicenseId', function() {
    it('valid UUID accepted', function() {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = validateMetadata({ replacementOfLicenseId: uuid });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.replacementOfLicenseId).to.equal(uuid);
    });

    it('invalid UUID rejected', function() {
      const result = validateMetadata({ replacementOfLicenseId: 'not-a-uuid' });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('UUID');
    });

    it('empty replacementOfLicenseId accepted', function() {
      const result = validateMetadata({ replacementOfLicenseId: '' });
      expect(result.errors).to.deep.equal([]);
    });
  });

  describe('lifecycleNote', function() {
    it('valid note accepted', function() {
      const result = validateMetadata({ lifecycleNote: 'some note' });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.lifecycleNote).to.equal('some note');
    });

    it('note longer than 500 rejected', function() {
      const result = validateMetadata({ lifecycleNote: 'x'.repeat(501) });
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.contain('500');
    });

    it('note at 500 chars accepted', function() {
      const result = validateMetadata({ lifecycleNote: 'x'.repeat(500) });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.lifecycleNote).to.equal('x'.repeat(500));
    });

    it('whitespace trimmed', function() {
      const result = validateMetadata({ lifecycleNote: '  note  ' });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.lifecycleNote).to.equal('note');
    });
  });

  describe('lifecycle cross-validation', function() {
    it('replacement without replacementOfLicenseId produces error', function() {
      const result = validateMetadata({ issueReason: 'replacement' });
      expect(result.errors).to.deep.equal([]);
      expect(result.metadata.issueReason).to.equal('replacement');
      expect(result.metadata.replacementOfLicenseId).to.equal(undefined);
    });
  });
});

'use strict';

const { FileSigningProvider } = require('./file_signing_provider');

const SUPPORTED_PROVIDERS = ['file'];
const RESERVED_PROVIDERS = ['vault', 'aws-kms', 'pkcs11', 'external'];

const createSigningProvider = (config = {}) => {
  const providerType = (config.signingProvider || process.env.PORTAL_SIGNING_PROVIDER || 'file').toLowerCase();

  if (RESERVED_PROVIDERS.includes(providerType)) {
    throw new Error('Signing provider "' + providerType + '" is not implemented yet');
  }

  if (!SUPPORTED_PROVIDERS.includes(providerType)) {
    throw new Error('Unknown signing provider: "' + providerType + '". Supported: ' + SUPPORTED_PROVIDERS.join(', '));
  }

  if (providerType === 'file') {
    return new FileSigningProvider({
      privateKeyPath: config.privateKeyPath,
      privateKeyPem: config.privateKeyPem,
      publicKeyPath: config.publicKeyPath,
      publicKeyPem: config.publicKeyPem,
    });
  }
};

module.exports = { createSigningProvider, SUPPORTED_PROVIDERS, RESERVED_PROVIDERS };

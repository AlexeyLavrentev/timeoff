'use strict';

class SigningProvider {
  async sign(_payload) {
    throw new Error('sign() not implemented');
  }

  async getPublicKeyPem() {
    throw new Error('getPublicKeyPem() not implemented');
  }

  getInfo() {
    throw new Error('getInfo() not implemented');
  }
}

module.exports = { SigningProvider };

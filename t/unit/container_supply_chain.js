'use strict';

const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;

describe('Community container supply chain', function() {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'publish-community-container.yml'),
    'utf8'
  );

  it('grants OIDC only for keyless release signing', function() {
    expect(workflow).to.include('id-token: write');
    expect(workflow).to.include('sigstore/cosign-installer@v4');
    expect(workflow).to.include('cosign sign --yes');
  });

  it('attests a platform-specific SPDX SBOM', function() {
    expect(workflow).to.include('anchore/sbom-action@v0');
    expect(workflow).to.include('${{ matrix.arch }}.spdx.json');
    expect(workflow).to.include('cosign attest --yes --type spdxjson');
    expect(workflow).to.include('${{ steps.build.outputs.digest }}');
  });
});

# LeavePilot container images

## Community image

The public multi-platform image is published to:

```text
ghcr.io/alexeylavrentev/leavepilot-community
```

Supported platforms:

- `linux/amd64`
- `linux/arm64`

Release tags include the full version, minor version, major version, `latest`,
and the source commit SHA. Production deployments should pin the full version:

```sh
export LEAVEPILOT_IMAGE=ghcr.io/alexeylavrentev/leavepilot-community:1.0.1
export SESSION_SECRET=replace-with-a-long-random-session-secret
export CRYPTO_SECRET=replace-with-a-long-random-crypto-secret

docker compose -f docker-compose.community-image.yml up -d
```

The standalone Compose file pulls the published image and does not require a
local source checkout to build the application.

## Publishing

The Community workflow runs automatically for new semantic version tags. An
existing tag can be published from GitHub Actions with **Run workflow** by
entering a tag such as `v1.0.1`.

The workflow:

1. verifies that the tag matches `package.json`;
2. builds `amd64` and `arm64` images in parallel on native GitHub-hosted runners;
3. publishes each platform by immutable digest;
4. checks the LeavePilot branding and Community/Premium boundary against the
   `amd64` digest;
5. combines both verified digests into the versioned multi-platform tags.

The first GHCR package is private by default. After its first successful
publication, change `leavepilot-community` visibility to **Public** in the
package settings.

After publishing, verify the manifest:

```sh
docker buildx imagetools inspect \
  ghcr.io/alexeylavrentev/leavepilot-community:1.0.1
```

The output must include both `linux/amd64` and `linux/arm64`.

## Premium delivery

LeavePilot Premium is delivered as a separate private image. The license and
public verification key are runtime secrets and are never embedded into either
container image.

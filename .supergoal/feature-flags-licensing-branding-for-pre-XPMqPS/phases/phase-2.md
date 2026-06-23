SUPERGOAL_PHASE_START
Phase: 2 of 8 — Build Entitlements
Task: Add the central feature catalog, license verification, config/env loading, and template helpers.
Type: brownfield, refactor, security
Mandatory commands: npm test
Acceptance criteria: 7
Evidence required: catalog diff snippet, license tests, safe license payload example
Depends on phases: 1

## Why

All server and UI gates need one consistent source of truth for feature availability.

## Work

- Add a central feature catalog under `lib/features/` with stable keys from `docs/feature-inventory.md`.
- Add a deployment-wide entitlement resolver that enables base features by default and premium features only when licensed.
- Add signed license verification using Node `crypto`; keep private signing material out of the repository.
- Accept license input from config/env and/or a configured license file path.
- Add config defaults to `config/app.json` and env overrides to `lib/config.js`.
- Expose feature checks to Express locals and Handlebars helpers without leaking license internals into templates.
- Add tests for no-license mode, valid license mode, invalid signatures, expired licenses, malformed payloads, unknown features, and env/config overrides.

## Acceptance criteria (all must pass — verify each in transcript)

- Every feature from `docs/feature-inventory.md` has one stable key in the catalog.
- No-license mode enables every `base` feature and disables every `premium` feature.
- A valid signed license enables only the premium features listed in its payload.
- Invalid, expired, malformed, or missing licenses do not enable premium features.
- License verification uses only public verification material in the app.
- Templates can call a helper such as `has_feature` without knowing license internals.
- `npm test` exits 0.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`

## Evidence required in transcript

- Diff snippet of feature catalog keys.
- Test summary showing license success and failure cases.
- Printed example of a decoded non-secret license payload used in tests.

## Notes

Treat licensing as self-hosted commercial gating. Do not promise tamper-proof DRM, and do not add an external payment provider in this phase.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

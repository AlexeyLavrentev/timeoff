SUPERGOAL_PHASE_START
Phase: 7 of 8 — Document Operations
Task: Document base mode, premium licensing, feature keys, and client branding configuration.
Type: brownfield, docs, security
Mandatory commands: npm test
Acceptance criteria: 6
Evidence required: docs file list, env example excerpt, test summary
Depends on phases: 1, 2, 3, 4, 5, 6

## Why

Future client deployments need repeatable, non-secret operational steps.

## Work

- Add or update docs under `docs/` for feature keys, base mode, premium mode, license payload format, license verification, and branding overrides.
- Add non-secret examples/fixtures for docs/tests.
- Update `.env.example` with variable names and comments for license and branding configuration.
- Ensure docs are honest about self-hosted source-visible licensing being commercial gating rather than unbreakable DRM.

## Acceptance criteria (all must pass — verify each in transcript)

- Docs explain that no-license mode is base-only.
- Docs list every feature key and whether it is base or premium.
- Docs show how to provide a signed license without committing secrets.
- Docs show how to customize brand name, domains, sender identity, and assets in one place.
- `.env.example` includes non-secret variable names and comments only.
- `npm test` exits 0.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`

## Evidence required in transcript

- Documentation file list.
- Excerpts of `.env.example` showing variable names without secrets.
- Test summary.

## Notes

Do not include real private keys, real customer data, or real signed commercial licenses.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

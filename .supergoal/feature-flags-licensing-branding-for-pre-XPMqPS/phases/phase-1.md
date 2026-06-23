SUPERGOAL_PHASE_START
Phase: 1 of 8 — Inventory Features
Task: Produce the base/premium feature inventory and add characterization tests before changing behavior.
Type: brownfield, refactor, security
Mandatory commands: npm test
Acceptance criteria: 5
Evidence required: feature inventory summary, test file list, mocha summary
Depends on phases: none

## Why

The repository already contains many user-added changes, so gating must start from an explicit inventory instead of guessing.

## Work

- Inspect current routes in `app.js`, route modules in `lib/route`, model/cache additions, views, locales, migrations, and recent git history.
- Create `docs/feature-inventory.md` with stable feature keys, classification, files/routes/templates, and reasoning.
- Classify conservatively: if a feature plausibly existed in the original/base app, mark it `base` unless evidence says otherwise.
- Add focused characterization tests under `t/` for base route/navigation behavior and representative premium candidate denial behavior that later phases will activate.
- Do not enforce gates in this phase.

## Acceptance criteria (all must pass — verify each in transcript)

- `docs/feature-inventory.md` lists every feature key, status (`base` or `premium`), primary files/routes/templates, and reason for classification.
- Inventory includes at least these candidates if present in code: vacation planning, time balance, reports, email audit, integration API, enterprise auth/SSO/LDAP/OIDC/SAML, theme/localization changes.
- Tests prove the current ungated app can still render/access existing base routes before the gating refactor begins.
- Tests establish expected base-mode denial behavior for at least two representative premium routes, ready to be enabled in later phases.
- `npm test` exits 0.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`

## Evidence required in transcript

- Printed feature inventory summary with feature keys and classifications.
- Test file list and mocha summary.
- Short note explaining any uncertain classification and why it was chosen.

## Notes

Use the current branch history as evidence, but do not rely on commit messages alone. Confirm with current files/routes/templates.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

SUPERGOAL_PHASE_START
Phase: 5 of 8 — Build Branding Core
Task: Add a central branding service/config and expose it to routes, helpers, and email rendering.
Type: brownfield, refactor, ui
Mandatory commands: npm test
Acceptance criteria: 5
Evidence required: branding object example, override tests, invalid value tests
Depends on phases: 2

## Why

Client branding should be changed in one place and then flow through the application.

## Work

- Add `lib/branding/index.js` or an equivalent module that returns normalized branding values.
- Add branding defaults in `config/branding.json` or a `branding` section of `config/app.json`.
- Add env overrides in `lib/config.js` for brand name, lowercase name, application domain, promotion domain, sender identity, logo/icon paths, support URL/email as appropriate.
- Add `res.locals.branding` and Handlebars helpers for brand access.
- Add tests for defaults, overrides, missing optional values, invalid URLs, and invalid emails.

## Acceptance criteria (all must pass — verify each in transcript)

- One module exposes normalized branding values with defaults matching current visible behavior.
- Brand name, lower-case name, application domain, promotion domain, email sender identity, and asset paths are configurable without editing templates.
- Missing optional branding values fall back safely.
- Invalid URL/email branding values are rejected or ignored with tests.
- `npm test` exits 0.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`

## Evidence required in transcript

- Printed default branding object from tests or a safe diagnostic.
- Test summary for defaults, overrides, and invalid values.

## Notes

Do not move secrets into branding config. Sender credentials remain in existing email transporter config.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

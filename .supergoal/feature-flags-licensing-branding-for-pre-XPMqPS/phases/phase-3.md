SUPERGOAL_PHASE_START
Phase: 3 of 8 — Gate Server Paths
Task: Protect premium routes, APIs, and relevant entry points at the server boundary.
Type: brownfield, refactor, security
Mandatory commands: npm test
Acceptance criteria: 6
Evidence required: route gate matrix, direct access tests, app.js gate snippet
Depends on phases: 1, 2

## Why

Premium functionality must not remain reachable by direct URLs or API calls after the UI hides it.

## Work

- Add or reuse feature-gate middleware for Express routers.
- Update `app.js` route mounting so premium routes are guarded according to `docs/feature-inventory.md`.
- Gate API/integration endpoints classified as premium.
- Gate relevant background/bin entry points if they operate on premium features.
- Keep base routes mounted and behaving according to existing auth rules.
- Add tests for base mode and licensed mode direct access.

## Acceptance criteria (all must pass — verify each in transcript)

- Direct requests to premium routes in base mode return a deliberate denial response (`404`, `403`, or redirect) consistently documented in tests.
- Licensed mode allows representative premium routes to reach their normal handlers.
- Base routes such as login, calendar, requests, users/admin basics, and settings basics remain accessible according to their existing auth rules.
- API/integration endpoints classified as premium are gated server-side.
- Gate failures do not leak stack traces or license internals.
- `npm test` exits 0.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`

## Evidence required in transcript

- Route gate matrix for base vs licensed mode.
- Test summary for direct URL/API access.
- Short diff snippet showing how routes are gated in `app.js`.

## Notes

Prefer small composable middleware over conditional logic scattered through handlers.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

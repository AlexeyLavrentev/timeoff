SUPERGOAL_PHASE_START
Phase: 4 of 6 — Migrate premium surfaces
Task: Move current premium routes, nav items, and notification providers behind registry-owned declarations.
Type: brownfield, refactor, hardening
Mandatory commands: node --check app.js; node --check lib/route/api/index.js; ./node_modules/.bin/mocha t/unit/features.js t/unit/edition_registry.js t/unit/route/login_register.js; git diff --check
Acceptance criteria: 6
Evidence required: grep route output, focused test output, registry ownership summary
Depends on phases: 3

## Why

Centralized declarations make it realistic to move premium implementation into a private module later without rediscovering scattered app integrations.

## Work

- Add a community/core premium capability registration module that declares current premium routes and nav/notification capabilities.
- Register time balance, vacation planning, groups, SSO settings, and integration API surfaces through the edition/capability registry while preserving existing route order.
- Update `app.js` so hardcoded direct premium `app.use` blocks are reduced or removed where safe.
- Update header rendering to consume registered premium nav items where practical while preserving existing labels/icons.
- Update `/api/v1/notifications/` to use registered notification providers and avoid loading premium models for disabled features.
- Add or update focused tests around disabled/enabled feature behavior and route registration where feasible.

## Acceptance criteria (all must pass — verify each in transcript)

- `app.js` no longer hardcodes direct `app.use('/time-balance/'...)` and `app.use('/vacation-plans/'...)`.
- Settings premium routes for groups, SSO, and Integration API remain protected by feature guards.
- Header hides premium nav items when features are disabled and shows them when enabled.
- `/api/v1/notifications/` does not execute premium providers when corresponding features are disabled.
- Existing focused feature/login/API tests pass.
- Docker-style baseline login path remains unaffected by disabled premium features.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `node --check app.js`
- `node --check lib/route/api/index.js`
- `./node_modules/.bin/mocha t/unit/features.js t/unit/edition_registry.js t/unit/route/login_register.js`
- `git diff --check`

## Evidence required in transcript

- `rg` or equivalent output showing migrated route declarations.
- Focused Mocha output.
- Summary of routes/nav/notifications now owned by registry.

## Notes

Do not change URLs or user-visible route paths. Route compatibility is required.

---

The agent will, during execution, print SUPERGOAL_PHASE_START (above),
do the work, then print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and
SUPERGOAL_PHASE_DONE in order. On failure, the agent follows the
3-strike recovery protocol in .supergoal/protect-premium-functions-open-core-KwQSeA/PROTOCOL.md without further
instruction needed here.

SUPERGOAL_PHASE_START
Phase: 3 of 6 — Build capability registry
Task: Extend edition registry beyond routes and schedulers into premium capabilities.
Type: brownfield, refactor, hardening
Mandatory commands: node --check lib/edition/registry.js; node --check lib/edition/index.js; ./node_modules/.bin/mocha t/unit/edition_registry.js; git diff --check
Acceptance criteria: 6
Evidence required: registry test output, capability type summary, git diff stat
Depends on phases: 1, 2

## Why

Premium capabilities should enter the app through one boundary so future private modules can own UI, notifications, routes, jobs, and diagnostics consistently.

## Work

- Extend `EditionRegistry` with registration/getter methods for navigation items, notification providers, and diagnostics.
- Validate required fields for each capability type.
- Ensure getters return copies and cannot mutate registry internals.
- Add helper methods that filter or execute providers by enabled feature where useful.
- Wire app locals minimally so templates can later consume registered navigation capabilities.
- Extend `t/unit/edition_registry.js` with validation and immutable readback tests.

## Acceptance criteria (all must pass — verify each in transcript)

- `registerNavigationItem` validates feature/name/path/labelKey/location or an equivalent explicit schema.
- `registerNotificationProvider` validates feature/type/fetch function.
- Notification providers can be listed without executing disabled feature providers.
- `registerDiagnostic` returns safe structured diagnostic entries.
- Existing route and scheduler behavior remains unchanged.
- Registry getters return copies, proven by mutation tests.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `node --check lib/edition/registry.js`
- `node --check lib/edition/index.js`
- `./node_modules/.bin/mocha t/unit/edition_registry.js`
- `git diff --check`

## Evidence required in transcript

- Mocha output for registry tests.
- Summary of supported capability types.
- `git diff --stat`.

## Notes

Keep this phase mostly infrastructure. Do not migrate existing app surfaces yet except harmless locals needed for later phases.

---

The agent will, during execution, print SUPERGOAL_PHASE_START (above),
do the work, then print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and
SUPERGOAL_PHASE_DONE in order. On failure, the agent follows the
3-strike recovery protocol in .supergoal/protect-premium-functions-open-core-KwQSeA/PROTOCOL.md without further
instruction needed here.

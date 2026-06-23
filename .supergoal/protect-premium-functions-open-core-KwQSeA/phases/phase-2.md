SUPERGOAL_PHASE_START
Phase: 2 of 6 — Harden module loader
Task: Add fail-closed premium module mode and complete loader contract tests.
Type: brownfield, refactor, hardening
Mandatory commands: node --check lib/edition/premium_loader.js; node --check lib/edition/index.js; ./node_modules/.bin/mocha t/unit/edition*.js; git diff --check
Acceptance criteria: 6
Evidence required: loader test output, config/docs diff summary, required mode env example
Depends on phases: 1

## Why

A commercial self-hosted build needs a clear way to fail startup if the private premium module is expected but missing.

## Work

- Add `TIMEOFF_PREMIUM_MODULE_REQUIRED` and `premium_module_required` handling.
- Make missing optional module preserve community behavior with a warning.
- Make missing required module throw a clear startup error naming the requested module.
- Ensure missing dependencies inside an installed module are not swallowed as optional module misses.
- Add `t/unit/edition_premium_loader.js` for function export, object `register`, optional missing, required missing, invalid export, and nested missing dependency.
- Update `config/app.json`, `config/app.redis.json`, and `docs/premium-module.md` with required-mode details.

## Acceptance criteria (all must pass — verify each in transcript)

- Empty `TIMEOFF_PREMIUM_MODULE` keeps community startup behavior.
- Missing optional premium module logs warning and does not throw.
- Missing required premium module throws a clear startup error.
- Missing dependency inside an installed module is re-thrown.
- Invalid module export throws a contract error.
- `docs/premium-module.md` documents `TIMEOFF_PREMIUM_MODULE_REQUIRED`.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `node --check lib/edition/premium_loader.js`
- `node --check lib/edition/index.js`
- `./node_modules/.bin/mocha t/unit/edition*.js`
- `git diff --check`

## Evidence required in transcript

- Mocha output for loader and registry tests.
- Diff summary showing config/docs/test updates.
- Example env line for required mode.

## Notes

Do not make optional missing modules fatal for normal community deployments.

---

The agent will, during execution, print SUPERGOAL_PHASE_START (above),
do the work, then print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and
SUPERGOAL_PHASE_DONE in order. On failure, the agent follows the
3-strike recovery protocol in .supergoal/protect-premium-functions-open-core-KwQSeA/PROTOCOL.md without further
instruction needed here.

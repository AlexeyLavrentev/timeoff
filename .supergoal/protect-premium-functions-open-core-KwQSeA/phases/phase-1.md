SUPERGOAL_PHASE_START
Phase: 1 of 6 — Harden license claims
Task: Enforce license expiry and expose safe license status for diagnostics.
Type: brownfield, refactor, hardening
Mandatory commands: node --check lib/features.js; node --check bin/sign_license.js; ./node_modules/.bin/mocha t/unit/features.js; git diff --check
Acceptance criteria: 6
Evidence required: test output, sanitized status shape, git diff stat
Depends on phases: none

## Why

License generation already accepts `--expires`, so runtime must enforce expiry and provide safe support diagnostics before stronger commercial controls can rely on it.

## Work

- Update `lib/features.js` so license payload validation recognizes valid future expiry, expired licenses, and malformed expiry.
- Add a safe `getLicenseStatus()` export that exposes only sanitized fields such as `valid`, `reason`, `customer`, `features`, `expires`, and source.
- Keep unsigned-license development behavior intact, but make expired or malformed expiry payloads disable licensed features.
- Extend `t/unit/features.js` with tests for future expiry, past expiry, malformed expiry, sanitized status, and explicit false kill switch.
- Update `bin/sign_license.js` help text if needed so `--expires` is discoverable.

## Acceptance criteria (all must pass — verify each in transcript)

- Signed license with future `expires` enables listed features in `NODE_ENV=production`.
- Signed license with past `expires` enables no premium features and reports reason `expired`.
- Signed license with malformed `expires` enables no premium features and reports reason `invalid_expiry`.
- `features.getLicenseStatus()` does not include signature, secret, or raw license text.
- Explicit `FEATURE_X=false` still disables a feature included in a valid license.
- Development unsigned license behavior remains available except for expired or invalid expiry payloads.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `node --check lib/features.js`
- `node --check bin/sign_license.js`
- `./node_modules/.bin/mocha t/unit/features.js`
- `git diff --check`

## Evidence required in transcript

- Mocha output for `t/unit/features.js`.
- Sanitized example of `features.getLicenseStatus()` keys, without secrets.
- `git diff --stat` for phase changes.

## Notes

Do not introduce network license checks in this phase. Keep all validation local and deterministic.

---

The agent will, during execution, print SUPERGOAL_PHASE_START (above),
do the work, then print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and
SUPERGOAL_PHASE_DONE in order. On failure, the agent follows the
3-strike recovery protocol in .supergoal/protect-premium-functions-open-core-KwQSeA/PROTOCOL.md without further
instruction needed here.

SUPERGOAL_PHASE_START
Phase: 5 of 6 — Document commercial builds
Task: Document self-hosted commercial deployment, private module extraction, and license operations.
Type: brownfield, hardening
Mandatory commands: node --check bin/sign_license.js; rg -n "TIMEOFF_PREMIUM_MODULE|TIMEOFF_PREMIUM_MODULE_REQUIRED|TIMEOFF_LICENSE|--expires" docs bin/sign_license.js; git diff --check
Acceptance criteria: 6
Evidence required: docs grep output, deployment mode summary, git diff stat
Depends on phases: 1, 2, 3, 4

## Why

Protection can fail operationally if customers or future maintainers cannot tell which deployment mode they are using or how private premium code is loaded.

## Work

- Update `docs/premium-module.md` with route/nav/notification/diagnostic examples and required commercial mode.
- Update `docs/features-branding.md` or add a focused commercial deployment section that explains license expiry and Docker env.
- Document development overrides separately from production licensing.
- Document why open source self-hosted cannot provide unbreakable DRM.
- Add examples for `TIMEOFF_PREMIUM_MODULE`, `TIMEOFF_PREMIUM_MODULE_REQUIRED`, `TIMEOFF_LICENSE`, `TIMEOFF_LICENSE_SECRET`, and `--expires`.
- Ensure examples use fake values only.

## Acceptance criteria (all must pass — verify each in transcript)

- Docs clearly state open-source self-hosted code cannot provide unbreakable DRM.
- Docs distinguish development overrides from production licensing.
- Docs include a commercial Docker Compose or `.env` example.
- Docs include a migration path for moving a premium feature into a private module.
- No real secrets or customer values appear in docs.
- Markdown references current variable names exactly.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `node --check bin/sign_license.js`
- `rg -n "TIMEOFF_PREMIUM_MODULE|TIMEOFF_PREMIUM_MODULE_REQUIRED|TIMEOFF_LICENSE|--expires" docs bin/sign_license.js`
- `git diff --check`

## Evidence required in transcript

- Grep output showing documented variables.
- Summary of supported deployment modes.
- `git diff --stat`.

## Notes

Keep docs honest: this raises the threshold and supports commercial distribution; it is not absolute DRM.

---

The agent will, during execution, print SUPERGOAL_PHASE_START (above),
do the work, then print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and
SUPERGOAL_PHASE_DONE in order. On failure, the agent follows the
3-strike recovery protocol in .supergoal/protect-premium-functions-open-core-KwQSeA/PROTOCOL.md without further
instruction needed here.

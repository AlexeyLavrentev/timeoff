SUPERGOAL_PHASE_START
Phase: 8 of 8 — Polish & Harden
Task: Run final regression, route/UI/license/branding audit, security review, and documentation cleanup.
Type: brownfield, refactor, security, ui
Mandatory commands: npm test, npm run build-css
Acceptance criteria: 8
Evidence required: final matrix, grep summary, diff stat, test and CSS summaries
Depends on phases: 1, 2, 3, 4, 5, 6, 7

## Why

This final pass catches regressions, half-gated paths, hardcoded branding, config leaks, and rough edges after the main implementation.

## Work

- Re-read `ROADMAP.md` and `docs/feature-inventory.md`.
- Verify every premium feature has both server-side gating and base-mode UI hiding.
- Verify every base feature remains available in no-license mode.
- Review license handling for secrets, private keys, malformed input, expired licenses, and unknown feature keys.
- Review branding output in at least one web render and one email render.
- Review docs and `.env.example` for completeness and absence of secrets.
- Run final grep checks for hardcoded brand mentions, debug logs, and session TODO/FIXME comments introduced in this run.

## Acceptance criteria (all must pass — verify each in transcript)

- `npm test` exits 0.
- `npm run build-css` exits 0.
- `git diff` contains no private signing keys, real license payloads, secrets, debug logs, or session TODO/FIXME comments.
- Every premium feature in `docs/feature-inventory.md` is gated server-side and absent from base-mode navigation.
- Every base feature in `docs/feature-inventory.md` remains available in no-license mode.
- Branding overrides are demonstrated in at least one web render and one email render.
- English and Russian visible brand references are either config-driven or documented intentional defaults.
- README/docs give enough operational steps to deploy base mode and licensed branded mode.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`
- `npm run build-css`

## Evidence required in transcript

- Final route/UI matrix.
- Final hardcoded-brand grep summary.
- Final `git diff --stat`.
- Final test and CSS build summaries.

## Notes

This is the last phase. After it passes, the executing agent must run the final audit from `PROTOCOL.md` before printing `SUPERGOAL_RUN_COMPLETE`.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

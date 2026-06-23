SUPERGOAL_PHASE_START
Phase: 6 of 6 — Polish & Harden
Task: Run final security, regression, cleanliness, and commit hygiene sweep.
Type: brownfield, hardening
Mandatory commands: git diff --check; ./node_modules/.bin/mocha t/unit/features.js t/unit/edition*.js t/unit/route/login_register.js; git status --short
Acceptance criteria: 6
Evidence required: final command summaries, git log summary, security limitation statement, commit hashes
Depends on phases: 1, 2, 3, 4, 5

## Why

The final pass catches cross-phase regressions and ensures the mechanism is honest, testable, and committed cleanly.

## Work

- Re-run all focused checks from earlier phases.
- Run `node --check` for every changed JS file in this run.
- Review added docs and code for misleading DRM claims, secrets, debug placeholders, or stale TODOs.
- Verify route order and disabled-premium baseline behavior are still sensible.
- Create small Russian commits for coherent increments if phases have not already done so.
- Prepare a final summary of what is protected, what remains patchable in open source, and the next recommended private-module extraction step.

## Acceptance criteria (all must pass — verify each in transcript)

- `git diff --check` exits 0.
- `node --check` passes for every changed JS file.
- Aggregated focused Mocha tests from phases 1..4 pass.
- `rg` finds no newly added raw secrets, debug placeholders, or misleading unbreakable-DRM claims.
- `git status --short` is clean except user-owned `.env` and unrelated `.supergoal` artifacts after commits.
- Final explanation states limitations and next extraction step.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `git diff --check`
- `./node_modules/.bin/mocha t/unit/features.js t/unit/edition*.js t/unit/route/login_register.js`
- `git status --short`

## Evidence required in transcript

- Final command summaries.
- Final `git log --oneline -6`.
- Security limitation statement.
- Commit hashes created in the run.

## Notes

Respect existing user-owned `.env` and active `.supergoal` folders. Do not delete or stage them.

---

The agent will, during execution, print SUPERGOAL_PHASE_START (above),
do the work, then print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and
SUPERGOAL_PHASE_DONE in order. On failure, the agent follows the
3-strike recovery protocol in .supergoal/protect-premium-functions-open-core-KwQSeA/PROTOCOL.md without further
instruction needed here.

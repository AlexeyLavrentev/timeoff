# Thinking: protect premium functions with open-core hardening

## Goals

- Raise the practical protection level for premium features in a self-hosted, non-SaaS product.
- Keep the community build functional without a premium module.
- Make the commercial build load private premium code through stable extension points.
- Keep licensing understandable, testable, and supportable in Docker production deployments.

## Constraints

- This is an open source self-hosted codebase, so no in-repo mechanism can be true DRM.
- The current branch is `inf/licensing-open-core`; user wants small Russian commits.
- Do not touch user-owned `.env` or `.supergoal` artifacts except this run namespace.
- Preserve existing base behavior and avoid route-order regressions.
- Tests should be focused because full browser/integration suite has been historically heavy.

## Risks

1. **False sense of security** — if premium implementation remains in public source, motivated users can patch checks. Mitigation: make the goal explicit: open-core extraction foundation, required premium module mode, and clear docs.
2. **Route-order regressions** — moving route registration into registries can accidentally shadow `/settings`, `/login`, or API routes. Mitigation: migrate in small clusters with route registration tests and targeted login/feature tests.
3. **License support opacity** — customers and support need to know why a feature is disabled without exposing secrets. Mitigation: add safe license status/diagnostics, no secret or raw signature disclosure.

## Dependencies

- License status must exist before diagnostics can show reliable reason codes.
- Premium module loader must support required mode before Docker/commercial docs can be accurate.
- Capability registry must exist before current premium routes/nav/notifications can be centralized.
- Final hardening depends on all migrations being complete.

## Open Questions Assumed

- We are not building SaaS yet.
- We are not removing all current premium implementation from this public repo in this run; we are creating the extraction architecture and hardening gates.
- Commercial/private module code will live outside this repo later, loaded by `TIMEOFF_PREMIUM_MODULE`.
- `ALLOW_UNLICENSED_FEATURE_OVERRIDES=true` remains a development escape hatch, not a production recommendation.

## Memory Hits Applied

- none — no applicable memory index found.

## Tools/Skills Relied On

- Supergoal skill for phase planning.
- Shell and `apply_patch` for implementation.
- Mocha unit tests and `node --check` for verification.
- Web research not needed; this is repo-local architecture work.

## Best Practices Applied

- Treat licensing as enforcement plus auditability, not unbreakable DRM.
- Keep extension contracts small and explicit: routes, nav/menus, notifications, schedulers, diagnostics.
- Prefer fail-closed mode for commercial builds that require a premium module.
- Keep safe diagnostics separate from secrets and raw license material.

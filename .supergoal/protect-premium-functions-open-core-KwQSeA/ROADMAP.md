# Roadmap: Protect premium functions with open-core hardening

**Task:** Strengthen premium feature protection beyond basic feature flags by hardening license validation, commercial module loading, and centralized premium capability registration.
**Type:** brownfield, refactor, hardening
**Created:** 2026-06-14
**Total phases:** 6

## Context summary

- **Stack:** Node.js 22, Express, Handlebars, Sequelize, Docker Compose.
- **Package manager:** npm.
- **Build / test / lint commands:** `node --check <changed js>`, focused `./node_modules/.bin/mocha ...`, `git diff --check`.
- **Risky areas:** `app.js` route order, `lib/features.js` licensing, `lib/edition`, premium route clusters, Docker production env.

## Assumptions

- We are building practical open-core protection for self-hosted deployments, not impossible DRM.
- The community app must continue to run without a premium module.
- Commercial builds may require a private module through `TIMEOFF_PREMIUM_MODULE`.
- Existing premium code can stay functional during this run while we prepare clean extraction boundaries.
- Small Russian commits should be created after coherent increments.

## Risk top 3

1. **Public premium code remains patchable** — likelihood: high, mitigation: create module boundaries and required commercial mode so future public release can omit private code cleanly.
2. **Centralized registry breaks route/nav behavior** — likelihood: medium, mitigation: migrate in phases, keep route order stable, add targeted unit tests.
3. **License status leaks sensitive data** — likelihood: medium, mitigation: expose only sanitized status, enabled features, customer, expiry, and reason codes.

## Phase map

| # | Phase | Depends on | Deliverable |
|---|-------|------------|-------------|
| 1 | Harden license claims | — | Enforced expiry and safe license status API in `lib/features.js` |
| 2 | Harden module loader | 1 | Required premium module mode and loader contract tests |
| 3 | Build capability registry | 1, 2 | Registry support for premium routes, navigation, notifications, diagnostics |
| 4 | Migrate premium surfaces | 3 | Current premium routes/nav/notifications registered through the central registry |
| 5 | Document commercial builds | 1, 2, 3, 4 | Docker/env/docs for commercial self-hosted deployments and private module extraction |
| 6 | Polish & Harden | 1..5 | Final security/regression sweep and small commits verified |

---

## Phase 1 — Harden license claims

**Why:** License generation already supports expiry, but runtime must enforce it and expose safe diagnostics before stronger commercial controls can be trusted.

**Deliverables:**
- `lib/features.js` exports sanitized license status helpers.
- `bin/sign_license.js` usage/docs reflect expiry behavior.
- Unit tests cover valid, expired, malformed, unsigned, and signed licenses.

**Acceptance criteria:**
- [ ] Signed license with future `expires` enables listed features in `NODE_ENV=production`.
- [ ] Signed license with past `expires` enables no premium features and status reason is `expired`.
- [ ] Malformed `expires` enables no premium features and status reason is `invalid_expiry`.
- [ ] `features.getLicenseStatus()` never returns signature, secret, or raw license string.
- [ ] Existing explicit `FEATURE_X=false` kill switch still disables a licensed feature.
- [ ] Existing development unsigned-license behavior remains unchanged unless expiry is invalid/expired.

**Mandatory commands:**
- `node --check lib/features.js`
- `node --check bin/sign_license.js`
- `./node_modules/.bin/mocha t/unit/features.js`
- `git diff --check`

**Evidence required:**
- Test output showing feature licensing cases pass.
- Snippet or summary of sanitized `getLicenseStatus()` shape.
- `git diff --stat` for the phase.

**Dependencies:** none

---

## Phase 2 — Harden module loader

**Why:** A commercial self-hosted build needs a fail-closed mode when the private premium module is required but missing or invalid.

**Deliverables:**
- `lib/edition/premium_loader.js` supports `TIMEOFF_PREMIUM_MODULE_REQUIRED` / `premium_module_required`.
- Loader distinguishes optional missing module from required missing module.
- Tests cover function export, object `register`, optional missing, required missing, invalid export, and nested missing dependency.

**Acceptance criteria:**
- [ ] Empty `TIMEOFF_PREMIUM_MODULE` keeps community startup behavior.
- [ ] Missing optional premium module logs warning and does not throw.
- [ ] Missing required premium module throws a clear startup error.
- [ ] Missing dependency inside an installed module is re-thrown, not misclassified as missing requested module.
- [ ] Invalid module export throws a contract error.
- [ ] `docs/premium-module.md` documents required mode.

**Mandatory commands:**
- `node --check lib/edition/premium_loader.js`
- `node --check lib/edition/index.js`
- `./node_modules/.bin/mocha t/unit/edition*.js`
- `git diff --check`

**Evidence required:**
- Test output for loader cases.
- Diff summary showing config/docs/test updates.
- Example env line for required mode.

**Dependencies:** phase 1

---

## Phase 3 — Build capability registry

**Why:** Premium features should register capabilities through one boundary instead of scattering route, menu, notification, and scheduler checks across core files.

**Deliverables:**
- `lib/edition/registry.js` supports route, scheduler, nav item, notification provider, and diagnostic registrations.
- Registry exposes read-only copies of registered capabilities.
- View helpers or locals can consume registered nav items without knowing module internals.
- Unit tests cover registration validation and immutable readbacks.

**Acceptance criteria:**
- [ ] `registerNavigationItem` requires feature/name/path/labelKey/location or equivalent validated fields.
- [ ] `registerNotificationProvider` requires feature/type/fetch function and does not run when feature is disabled.
- [ ] `registerDiagnostic` returns safe structured diagnostic entries.
- [ ] Existing `registerRoute` and `registerScheduler` tests still pass.
- [ ] Registry getters return copies so callers cannot mutate internal arrays.
- [ ] No app behavior is migrated yet in this phase except wiring locals for future consumption.

**Mandatory commands:**
- `node --check lib/edition/registry.js`
- `node --check lib/edition/index.js`
- `./node_modules/.bin/mocha t/unit/edition_registry.js`
- `git diff --check`

**Evidence required:**
- Test output for new capability registry cases.
- Summary of supported capability types.
- `git diff --stat`.

**Dependencies:** phases 1, 2

---

## Phase 4 — Migrate premium surfaces

**Why:** Centralizing current premium surfaces makes it possible to move their implementation into a private module later without hunting through app routes/templates.

**Deliverables:**
- Premium route declarations are centralized in an edition/community capability registration module.
- `app.js` mounts premium routes through the registry while preserving order and guards.
- Header premium menu items are driven from registered nav capabilities where practical.
- Notification providers for `time_balance` and `vacation_planning` move behind registry providers.
- Tests cover disabled features, enabled features, and route registration order where feasible.

**Acceptance criteria:**
- [ ] `app.js` no longer hardcodes direct `app.use('/time-balance/'...)` and `app.use('/vacation-plans/'...)`; they come from registry registration.
- [ ] Settings premium routes for groups, SSO, and Integration API remain protected by feature guards after migration.
- [ ] Header still hides premium nav items when features are disabled and shows them when enabled.
- [ ] `/api/v1/notifications/` does not require premium models when corresponding features are disabled.
- [ ] Existing focused feature/login/API tests pass.
- [ ] Docker baseline login still works without premium features.

**Mandatory commands:**
- `node --check app.js`
- `node --check lib/route/api/index.js`
- `./node_modules/.bin/mocha t/unit/features.js t/unit/edition_registry.js t/unit/route/login_register.js`
- `git diff --check`

**Evidence required:**
- Grep output showing migrated route declarations.
- Test output for focused regression set.
- Summary of routes/nav/notifications now owned by registry.

**Dependencies:** phase 3

---

## Phase 5 — Document commercial builds

**Why:** Protection fails operationally if the commercial deployment path is unclear or easy to misconfigure.

**Deliverables:**
- `docs/premium-module.md` explains private module packaging, required mode, route/nav/notification/diagnostic contracts, and failure behavior.
- `docs/features-branding.md` and/or a new deployment doc explains production license expiry, Docker env, and commercial image recommendations.
- Example `.env` snippets include `TIMEOFF_PREMIUM_MODULE`, `TIMEOFF_PREMIUM_MODULE_REQUIRED`, `TIMEOFF_LICENSE`, and `TIMEOFF_LICENSE_SECRET`.
- Sign-license help text documents `--expires` with examples.

**Acceptance criteria:**
- [ ] Docs clearly state open-source self-hosted code cannot provide unbreakable DRM.
- [ ] Docs distinguish development overrides from production licensing.
- [ ] Docs include a commercial Docker Compose example.
- [ ] Docs include a migration path for moving a premium feature into a private module.
- [ ] No secrets or real customer values appear in docs.
- [ ] Markdown references current variable names exactly.

**Mandatory commands:**
- `node --check bin/sign_license.js`
- `rg -n "TIMEOFF_PREMIUM_MODULE|TIMEOFF_PREMIUM_MODULE_REQUIRED|TIMEOFF_LICENSE|--expires" docs bin/sign_license.js`
- `git diff --check`

**Evidence required:**
- Grep output showing documented variables.
- Summary of deployment modes.
- `git diff --stat`.

**Dependencies:** phases 1, 2, 3, 4

---

## Phase 6 — Polish & Harden

**Why:** Catch security, regression, route-order, documentation, and cleanliness gaps after the architecture changes are complete.

**Deliverables:**
- Final hardening pass over license, edition loader, registry, app route order, Docker env docs, and tests.
- Small Russian commits for completed increments if not already committed by phases.
- Final status summary with remaining limitations and next recommended extraction step.

**Acceptance criteria:**
- [ ] `git diff --check` exits 0.
- [ ] `node --check` passes for every changed JS file.
- [ ] Aggregated focused Mocha tests from phases 1..4 pass.
- [ ] `rg` shows no newly added raw secrets, debug placeholders, or misleading DRM claims.
- [ ] `git status --short` contains only user-owned `.env` / unrelated `.supergoal` plus intentional run artifacts before final commit, or is clean except user-owned files after commit.
- [ ] Final explanation states what is protected, what remains patchable in open source, and the next private-module extraction step.

**Mandatory commands:**
- `git diff --check`
- `./node_modules/.bin/mocha t/unit/features.js t/unit/edition*.js t/unit/route/login_register.js`
- `git status --short`

**Evidence required:**
- Final command summaries.
- Final `git log --oneline -6`.
- Security limitation statement.
- Commit hashes created in the run.

**Dependencies:** phases 1, 2, 3, 4, 5

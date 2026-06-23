# Roadmap: Feature Flags, Licensing, And Branding

**Task:** Preserve the base TimeOff application while making added functionality opt-in through feature gates/licensing, and centralize client branding.
**Type:** brownfield, refactor, security, ui
**Created:** 2026-06-12
**Total phases:** 8

## Context summary

- **Stack:** Node.js, Express, Handlebars, Sequelize, i18next, Sass.
- **Package manager:** npm.
- **Build / test / lint commands:** `npm test`; `npm run build-css`.
- **Risky areas:** route mounting in `app.js`, primary navigation in `views/partials/header.hbs`, template helpers in `lib/view/helpers.js`, email rendering in `lib/email.js`, config in `lib/config.js`, localization files, static brand assets.

## Assumptions

- The default no-license mode must expose only the base/original product.
- Licensing is deployment-wide for this iteration, supplied by env/config/license file, not per tenant in the database.
- The license check should use a signed JSON payload and public-key verification; the private signing key is never committed.
- Premium feature candidates include vacation planning, time balance, reports, email audit, integration API, and enterprise auth, but phase 1 must produce the final feature inventory before gates are enforced.
- Branding is configured through one app-level surface with env overrides and sensible defaults; client-specific changes should not require editing templates.

## Risk top 3

1. **Accidentally disabling base behavior** — likelihood: medium, mitigation: characterize base navigation/routes before gating and keep base features explicit in the catalog.
2. **Premium routes remain reachable directly** — likelihood: medium, mitigation: add route/middleware gates and test direct URL access, not just hidden nav links.
3. **License/branding config becomes scattered** — likelihood: high, mitigation: add `lib/features` and `lib/branding` services first, then require all integrations to go through those modules.

## Phase map

| # | Phase | Depends on | Deliverable |
|---|-------|------------|-------------|
| 1 | Inventory Features | — | A checked-in feature inventory and characterization tests for base/premium candidates |
| 2 | Build Entitlements | 1 | Central feature catalog, license verifier, config/env loader, and template helpers |
| 3 | Gate Server Paths | 1, 2 | Premium route/API/job access gated server-side with tests |
| 4 | Gate UI Surfaces | 1, 2, 3 | Navigation, settings links, modals, scripts, and visible premium UI hidden in base mode |
| 5 | Build Branding Core | 2 | Central branding service/config with tests and template locals |
| 6 | Apply Branding | 5 | Header, layout, manifest/icon/email/locales wired to branding config |
| 7 | Document Operations | 1, 2, 3, 4, 5, 6 | Docs/examples for base mode, premium license, and client branding |
| 8 | Polish & Harden | 1..7 | Final regression, security, UX, and config audit |

---

## Phase 1 — Inventory Features

**Why:** The project already contains many user-added changes, so the executor must identify what is base vs premium before changing behavior.

**Deliverables:**
- `docs/feature-inventory.md`
- Focused characterization tests under `t/` for base-mode navigation/routes and premium candidates.

**Acceptance criteria:**
- [ ] `docs/feature-inventory.md` lists every feature key, status (`base` or `premium`), primary files/routes/templates, and reason for classification.
- [ ] Inventory includes at least these candidates if present in code: vacation planning, time balance, reports, email audit, integration API, enterprise auth/SSO/LDAP/OIDC/SAML, theme/localization changes.
- [ ] Tests prove the current ungated app can still render/access existing base routes before the gating refactor begins.
- [ ] Tests establish expected base-mode denial behavior for at least two representative premium routes, ready to be enabled in later phases.
- [ ] `npm test` exits 0.

**Mandatory commands:**
- `npm test`

**Evidence required:**
- Printed feature inventory summary with feature keys and classifications.
- Test file list and mocha summary.

**Dependencies:** none

---

## Phase 2 — Build Entitlements

**Why:** All later gates need one consistent source of truth for feature availability and license validity.

**Deliverables:**
- `lib/features/catalog.js`
- `lib/features/index.js`
- `lib/features/license.js` or equivalent signed-license verifier.
- Config defaults in `config/app.json` and env loading in `lib/config.js`.
- Handlebars helpers/locals for feature checks.
- Unit tests for catalog, license parsing, expired/invalid licenses, base defaults, and env overrides.

**Acceptance criteria:**
- [ ] Every feature from `docs/feature-inventory.md` has one stable key in the catalog.
- [ ] No-license mode enables every `base` feature and disables every `premium` feature.
- [ ] A valid signed license enables only the premium features listed in its payload.
- [ ] Invalid, expired, malformed, or missing licenses do not enable premium features.
- [ ] License verification uses only public verification material in the app.
- [ ] Templates can call a helper such as `has_feature` without knowing license internals.
- [ ] `npm test` exits 0.

**Mandatory commands:**
- `npm test`

**Evidence required:**
- Diff snippet of feature catalog keys.
- Test summary showing license success and failure cases.
- Printed example of a decoded non-secret license payload used in tests.

**Dependencies:** 1

---

## Phase 3 — Gate Server Paths

**Why:** Premium behavior must be protected at the server boundary, not merely hidden from the UI.

**Deliverables:**
- Feature-gate middleware for Express routes.
- `app.js` route mounting updated to gate premium routers.
- Any premium background/bin entry points or API handlers guarded where applicable.
- Tests for direct access to premium routes in base and licensed modes.

**Acceptance criteria:**
- [ ] Direct requests to premium routes in base mode return a deliberate denial response (`404`, `403`, or redirect) consistently documented in tests.
- [ ] Licensed mode allows representative premium routes to reach their normal handlers.
- [ ] Base routes such as login, calendar, requests, users/admin basics, and settings basics remain accessible according to their existing auth rules.
- [ ] API/integration endpoints classified as premium are gated server-side.
- [ ] Gate failures do not leak stack traces or license internals.
- [ ] `npm test` exits 0.

**Mandatory commands:**
- `npm test`

**Evidence required:**
- Route gate matrix for base vs licensed mode.
- Test summary for direct URL/API access.
- Short diff snippet showing how routes are gated in `app.js`.

**Dependencies:** 1, 2

---

## Phase 4 — Gate UI Surfaces

**Why:** Users in base mode should not see links, controls, badges, or scripts for features they cannot use.

**Deliverables:**
- Navigation/settings/template updates using the feature helper.
- JS boot payload adjusted so premium client behavior is absent or inert in base mode.
- Localized disabled/upgrade copy only where an explicit denial page is used.
- UI tests or rendered-template tests for base vs licensed navigation.

**Acceptance criteria:**
- [ ] Base-mode header does not render premium nav links for features classified as premium.
- [ ] Licensed mode renders the relevant premium nav links.
- [ ] Settings dropdown hides premium admin links in base mode.
- [ ] Any premium modals/partials/scripts are not rendered or initialized in base mode.
- [ ] Existing base navigation still renders in English and Russian locales.
- [ ] `npm test` exits 0.
- [ ] `npm run build-css` exits 0 if stylesheet changes are made.

**Mandatory commands:**
- `npm test`
- `npm run build-css`

**Evidence required:**
- Rendered HTML excerpts for base and licensed header/settings states.
- Test summary and CSS build summary.

**Dependencies:** 1, 2, 3

---

## Phase 5 — Build Branding Core

**Why:** Client branding must be changed in one place and then flow into templates, emails, metadata, and helper output.

**Deliverables:**
- `lib/branding/index.js` or equivalent service.
- `config/branding.json` or `config/app.json` `branding` section with defaults.
- Env overrides in `lib/config.js` for brand name, sender name/email, promotion URL, app URL, logo/icon paths, support URL/email as applicable.
- `res.locals.branding` and Handlebars helpers for brand values.
- Tests for defaults and overrides.

**Acceptance criteria:**
- [ ] One module exposes normalized branding values with defaults matching current visible behavior.
- [ ] Brand name, lower-case name, application domain, promotion domain, email sender identity, and asset paths are configurable without editing templates.
- [ ] Missing optional branding values fall back safely.
- [ ] Invalid URL/email branding values are rejected or ignored with tests.
- [ ] `npm test` exits 0.

**Mandatory commands:**
- `npm test`

**Evidence required:**
- Printed default branding object from tests or a safe diagnostic.
- Test summary for defaults, overrides, and invalid values.

**Dependencies:** 2

---

## Phase 6 — Apply Branding

**Why:** The new branding core only protects future maintenance if all visible mentions use it.

**Deliverables:**
- `views/partials/header.hbs`, `views/layouts/main.hbs`, `views/email/wrapper.hbs`, relevant email templates, locale brand entries, static manifest/icon references wired through branding.
- Any helper replacing direct `application_domain` / `promotion_website_domain` calls where appropriate.
- Tests or rendered-template checks for customized brand values in web and email output.

**Acceptance criteria:**
- [ ] Header brand text changes when branding config changes.
- [ ] HTML title/meta/manifest/icon references use branding config where supported by the existing static setup.
- [ ] Email wrapper footer and sender identity use branding config.
- [ ] Existing localization still works for English and Russian.
- [ ] `rg` finds no remaining user-facing hardcoded `TimeOff.Management` or old brand strings outside docs/history/intentional defaults.
- [ ] `npm test` exits 0.
- [ ] `npm run build-css` exits 0 if stylesheet changes are made.

**Mandatory commands:**
- `npm test`
- `npm run build-css`

**Evidence required:**
- Rendered web/email excerpts with a test brand.
- `rg` summary for hardcoded brand mentions.
- Test and CSS build summaries.

**Dependencies:** 5

---

## Phase 7 — Document Operations

**Why:** Future sales/client deployments need a repeatable way to run base mode, apply licenses, and customize branding.

**Deliverables:**
- Documentation under `docs/` for feature keys, license payload format, license verification, base mode, premium mode, and branding overrides.
- Example non-secret config/license fixtures suitable for tests/docs.
- `.env.example` updated with non-secret feature/license/branding variables.

**Acceptance criteria:**
- [ ] Docs explain that no-license mode is base-only.
- [ ] Docs list every feature key and whether it is base or premium.
- [ ] Docs show how to provide a signed license without committing secrets.
- [ ] Docs show how to customize brand name, domains, sender identity, and assets in one place.
- [ ] `.env.example` includes non-secret variable names and comments only.
- [ ] `npm test` exits 0.

**Mandatory commands:**
- `npm test`

**Evidence required:**
- Documentation file list.
- Excerpts of `.env.example` showing variable names without secrets.
- Test summary.

**Dependencies:** 1, 2, 3, 4, 5, 6

---

## Phase 8 — Polish & Harden

**Why:** This pass catches regressions, config leaks, half-gated paths, hardcoded branding, and rough UX after the main implementation.

**Deliverables:**
- Final security/config review.
- Final route/UI matrix for base and licensed modes.
- Final docs review.
- Any small fixes needed to satisfy the roadmap.

**Acceptance criteria:**
- [ ] `npm test` exits 0.
- [ ] `npm run build-css` exits 0.
- [ ] `git diff` contains no private signing keys, real license payloads, secrets, debug logs, or session TODO/FIXME comments.
- [ ] Every premium feature in `docs/feature-inventory.md` is gated server-side and absent from base-mode navigation.
- [ ] Every base feature in `docs/feature-inventory.md` remains available in no-license mode.
- [ ] Branding overrides are demonstrated in at least one web render and one email render.
- [ ] English and Russian visible brand references are either config-driven or documented intentional defaults.
- [ ] README/docs give enough operational steps to deploy base mode and licensed branded mode.

**Mandatory commands:**
- `npm test`
- `npm run build-css`

**Evidence required:**
- Final route/UI matrix.
- Final hardcoded-brand grep summary.
- Final `git diff --stat`.
- Final test and CSS build summaries.

**Dependencies:** 1, 2, 3, 4, 5, 6, 7

# State: Feature Flags, Licensing, And Branding

**Status:** IMPLEMENTED_VERIFIED
**Current phase:** Verification
**Started:** 2026-06-12
**Last update:** 2026-06-13
**Run root:** .supergoal/feature-flags-licensing-branding-for-pre-XPMqPS
**Baseline ref:** —

## Phase progress

| # | Phase | Status | Started | Completed | Notes |
|---|-------|--------|---------|-----------|-------|
| 1 | Inventory Features | completed | 2026-06-13 | 2026-06-13 | Premium-like additions identified: SSO, integration API, time balance, vacation planning, groups, work calendars, leave reminders. |
| 2 | Build Entitlements | completed | 2026-06-13 | 2026-06-13 | Added `lib/features.js` with env/config/license payload support. |
| 3 | Gate Server Paths | completed | 2026-06-13 | 2026-06-13 | Added guards for premium routes and SSO login flow. |
| 4 | Gate UI Surfaces | completed | 2026-06-13 | 2026-06-13 | Header/settings/work-calendar UI now uses `feature_enabled`. |
| 5 | Build Branding Core | completed | 2026-06-13 | 2026-06-13 | Added `lib/branding.js`; config/env drive name, logo, favicon, domains. |
| 6 | Apply Branding | completed | 2026-06-13 | 2026-06-13 | Applied branding to layout, header, email wrapper, email subjects, feed domain. |
| 7 | Document Operations | completed | 2026-06-13 | 2026-06-13 | Added `docs/features-branding.md`. |
| 8 | Polish & Harden | completed | 2026-06-13 | 2026-06-13 | Full `npm test` green after Node 22/Selenium helper stabilization. |

## Engineering check status

- Build: `npm run build-css` green on 2026-06-13 17:13 +05; Sass deprecation warnings remain.
- Typecheck: —
- Lint: —
- Tests: full `npm test` green on 2026-06-13 17:12 +05 (`932 passing`); focused leave-type limits rerun green (`26 passing`); earlier focused Selenium rerun green for the 12 previous failures (`89 passing`); unit suite green (`112 passing`, also covered by full run).

## Notable events

- 2026-06-12 — Plan drafted, 8 phases.
- 2026-06-12 — Pre-flight red: `npm test` could not run because `npm` is not in PATH and `node_modules/mocha/bin/mocha` is missing.
- 2026-06-12 — Node 22 found at `/Users/aleksey/.nvm/versions/node/v22.22.3/bin`; dependencies installed with `PUPPETEER_SKIP_DOWNLOAD=true`.
- 2026-06-12 — Pre-flight red after retry: `npm test` began, reported early failures in registration/bank holiday integration tests, then hung after `Unhandled rejection TypeError: Cannot read properties of undefined (reading 'get')` in `t/lib/open_page.js:14`; process was interrupted with SIGINT.
- 2026-06-12 — Pre-flight CSS green: `npm run build-css` exited 0 with Sass deprecation warnings only.
- 2026-06-12 — Stabilized Selenium helpers (`submit_form`, `login_with_user`, `logout_user`, `open_page`) to return normal promise chains instead of relying on Selenium control-flow side effects.
- 2026-06-12 — Fixed auto-approval revoke assertions to wait for the revoke flash and disappearance of request rows. `npm test -- --grep "Auto approvals"` green (`31 passing`); `npm test -- --grep "Auto approval leave type"` green (`30 passing`).
- 2026-06-12 — Unit suite green via `node node_modules/mocha/bin/mocha --recursive t/unit` (`112 passing`).
- 2026-06-12 — Full `npm test` attempt was rejected by the escalated-command approval layer because the session hit its usage limit; no full-suite result is available after the latest fixes.
- 2026-06-13 — Full `npm test` reached completion before the feature/branding pass: `920 passing`, `12 failing`.
- 2026-06-13 — Fixed the 12 failures with focused verification: `npm test -- --grep "Edit individual department|Login page SSO UX|Register new user|Case when holidays spans|Check that values for new columns|auth security middleware|Register route"` green (`89 passing`).
- 2026-06-13 — Added `lib/features.js`, `lib/branding.js`, `docs/features-branding.md`, feature guards, branding helpers, and route/template gating.
- 2026-06-13 — Post-implementation checks: JSON/module smoke test green, Handlebars render smoke test green, unit suite green (`112 passing`), CSS build green with Sass warnings.
- 2026-06-13 — Full `npm test` rerun after feature/branding implementation was rejected by the escalated-command approval layer because the session hit its usage limit; no full-suite result is available after the final implementation pass.
- 2026-06-13 — Stabilized Node 22 Selenium form helpers further: text/date inputs preserve native typing where available, select fields dispatch change reliably, alert text is read through DOM textContent to avoid Selenium 4 WebElement shape mismatches.
- 2026-06-13 — Focused leave-type limits verification green: `npm test -- --grep "Leave type limits"` (`26 passing`).
- 2026-06-13 — Final full verification green: `PATH=/Users/aleksey/.nvm/versions/node/v22.22.3/bin:$PATH npm test` (`932 passing`, 4m). Follow-up `npm run build-css` green with Sass warnings and `git diff --check` clean.

## Failure log

- Resolved: full Selenium/unit suite rerun is now green under Node 22.

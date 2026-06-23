SUPERGOAL_PHASE_START
Phase: 6 of 8 — Apply Branding
Task: Replace user-facing brand mentions in web, email, metadata, and assets with the branding service.
Type: brownfield, refactor, ui
Mandatory commands: npm test, npm run build-css
Acceptance criteria: 7
Evidence required: rendered web/email excerpts, hardcoded brand grep, test and CSS summaries
Depends on phases: 5

## Why

The branding core only helps if templates and emails actually consume it.

## Work

- Update `views/partials/header.hbs`, `views/layouts/main.hbs`, `views/email/wrapper.hbs`, relevant email templates, locale brand entries, and helper functions to use branding config.
- Adjust manifest/icon references where the existing static setup allows config-driven paths.
- Replace direct uses of `application_domain` and `promotion_website_domain` helpers where branding provides the intended source of truth.
- Add rendered-template/email checks that prove a test brand appears in output.
- Run a grep audit for hardcoded legacy brand names.

## Acceptance criteria (all must pass — verify each in transcript)

- Header brand text changes when branding config changes.
- HTML title/meta/manifest/icon references use branding config where supported by the existing static setup.
- Email wrapper footer and sender identity use branding config.
- Existing localization still works for English and Russian.
- `rg` finds no remaining user-facing hardcoded `TimeOff.Management` or old brand strings outside docs/history/intentional defaults.
- `npm test` exits 0.
- `npm run build-css` exits 0 if stylesheet changes are made; if no stylesheet changes are made, run it anyway as a smoke check.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`
- `npm run build-css`

## Evidence required in transcript

- Rendered web/email excerpts with a test brand.
- `rg` summary for hardcoded brand mentions.
- Test and CSS build summaries.

## Notes

If a static asset cannot be runtime-configured without a larger asset pipeline, document the supported replacement path and keep an intentional default.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

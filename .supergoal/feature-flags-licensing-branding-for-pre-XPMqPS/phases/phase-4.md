SUPERGOAL_PHASE_START
Phase: 4 of 8 — Gate UI Surfaces
Task: Hide premium navigation, settings links, modals, scripts, and visible controls in base mode.
Type: brownfield, refactor, ui
Mandatory commands: npm test, npm run build-css
Acceptance criteria: 7
Evidence required: base/licensed HTML excerpts, tests, CSS build summary
Depends on phases: 1, 2, 3

## Why

Base-mode users should see a coherent base product, not dead links or controls for disabled features.

## Work

- Update `views/partials/header.hbs` and settings-related templates to use feature helpers for premium links.
- Hide premium partials/modals/scripts where applicable.
- Ensure JS boot payload does not initialize premium-only client behavior in base mode.
- Add rendered-template or integration tests for base and licensed navigation.
- Keep English and Russian localization intact.

## Acceptance criteria (all must pass — verify each in transcript)

- Base-mode header does not render premium nav links for features classified as premium.
- Licensed mode renders the relevant premium nav links.
- Settings dropdown hides premium admin links in base mode.
- Any premium modals/partials/scripts are not rendered or initialized in base mode.
- Existing base navigation still renders in English and Russian locales.
- `npm test` exits 0.
- `npm run build-css` exits 0 if stylesheet changes are made; if no stylesheet changes are made, run it anyway as a smoke check.

## Mandatory commands (run each, surface last ~10 lines + exit code)

- `npm test`
- `npm run build-css`

## Evidence required in transcript

- Rendered HTML excerpts for base and licensed header/settings states.
- Test summary.
- CSS build summary.

## Notes

Server gates from phase 3 remain the authority. UI hiding is for clarity and polish, not security by itself.

---

The agent will, during execution, print SUPERGOAL_PHASE_VERIFY, MEMORY_SAVED, and SUPERGOAL_PHASE_DONE in order.

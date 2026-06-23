# Thinking

## Goals

- Preserve the original/base application behavior as the default install.
- Move user-added or commercial features behind a central entitlement layer that can enable or disable them per deployment.
- Add a licensing mechanism for premium features without introducing an external payment dependency.
- Add one branding configuration surface for app name, sender identity, promotion URLs, logo/icon paths, email mentions, and manifest/meta values.
- Keep the implementation compatible with this older Express/Handlebars code style.

## Constraints

- Brownfield project with many existing changes; do not revert unrelated user work.
- Only `.env` is untracked at planning time; do not touch it.
- The app is likely self-hosted and source-visible, so licensing should be treated as commercial gating/deterrence, not unbreakable DRM.
- Avoid storing private signing secrets in the repository. The application should verify signed licenses with public material only.
- Base functionality must remain available with no license configured.

## Risks

1. Misclassifying a base feature as premium could regress the original app. Mitigation: start with feature inventory, classify conservatively, and add tests for base navigation/routes.
2. UI-only hiding would leave premium routes/API callable directly. Mitigation: gate at route/middleware/service level first, then mirror in navigation/templates.
3. Branding can stay partially hardcoded in email/assets/locales. Mitigation: introduce a single branding service and audit templates/config/static manifest references.

## Dependencies

- The feature inventory phase must happen before any gating.
- Core entitlement helpers must exist before route/UI integrations.
- Branding service must exist before replacing template/email/asset references.
- Tests and docs depend on final feature keys and config names.

## Assumptions

- Licensing is deployment-wide for now, not per company/tenant inside the database.
- Premium features are enabled by a signed JSON license supplied through env or a configured license file.
- The app can ship with no license in "base" mode.
- Initial premium candidates include vacation planning, time balance, reports, email audit, integration API, and enterprise auth, but phase 1 must verify this list from code/history before enforcing it.
- Client-specific branding should be file/env driven, not edited directly in templates for each client.

## Best Practices Applied

- Central feature catalog with stable keys; no scattered string literals.
- Server-side gates before UI hiding.
- Fail-closed for unknown premium feature keys, fail-open only for explicitly base features.
- Signed license verification using Node `crypto` and a public verification key; private signing key remains outside the app.
- Config-driven branding with explicit fallback to current visible brand values.

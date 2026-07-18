# Bug Reproducer

## ✅ FIX_PROVEN — Bug reproduced and fix proven

> DEF-0002–DEF-0005 воспроизведены до изменений, те же сфокусированные контракты и пользовательские сценарии проходят после исправлений; полные Core и Premium suites завершены с exit 0.

**Project:** LeavePilot (timeoff + timeoff-premium)  
**Bug:** DEF-0002–DEF-0005: доступность, удаление компании и Selenium readiness  
**Environment:** macOS, Node.js/npm workspace, Express 5.2.1, Selenium WebDriver, Chrome 148, Asia/Yekaterinburg  
**Generated:** 2026-07-18

## Original report

Пользователь разрешил исправить DEF-0002–DEF-0004, добавить сфокусированные регрессионные тесты и стабилизировать readiness полного Selenium-прогона.

| Contract | Expected | Actual |
|---|---|---|
| Observed behavior | Все интерактивные controls имеют уникальные локализованные accessible names; удаление компании попадает в зарегистрированный route; тестовый runner начинает Selenium только после готовности приложения и использует совместимый ChromeDriver. | До исправлений часть controls была без доступных имён, Remove company отправлял двойной slash и получал 404, а npm test выбирал ChromeDriver 151 для Chrome 148 и маскировал ошибку таймаутами. |

## Minimal reproduction

Сфокусированные template/DOM contracts, company deletion Selenium-сценарий и отдельный browser readiness test были запущены до и после production-изменений.

**Confirming signal:** 4 Core и 2 Premium accessibility failures; 404 и 3 Selenium timeouts в company deletion; SessionNotCreatedError для ChromeDriver 151/Chrome 148.

### Reproduction files approved at Gate 1

- [settings_accessibility_contract.js](/Users/aleksey/projects/timeoff/t/unit/settings_accessibility_contract.js:1) — Core accessibility и route contracts.
- [accessibility_contract.test.js](/Users/aleksey/projects/timeoff-premium/test/accessibility_contract.test.js:1) — Premium accessibility contracts.
- [runner_readiness.js](/Users/aleksey/projects/timeoff/t/integration/runner_readiness.js:1) — Реальная browser readiness проверка.
- [delete_account.js](/Users/aleksey/projects/timeoff/t/integration/company/delete_account.js:1) — Существующий полный сценарий удаления компании.

## Red to green evidence

| Evidence | Before fix | After fix |
|---|---:|---:|
| Exit code | 1 | 0 |
| Timed out | False | False |
| Duration | 18,000 ms | 22,000 ms |
| Same command | — | True |
| Broader suite | — | passed |

### Before — failing evidence

```text
Core focused contracts: 4 failures. Premium accessibility contracts: 2 failures. Remove company submitted /settings//company/delete/, returned 404; company/delete_account: 11 passing, 3 timeout. Readiness diagnostic: SessionNotCreatedError because ChromeDriver 151 supports Chrome 151 while installed browser is Chrome 148.
```

### After — fixed evidence

```text
Core focused contracts: 5 passing. Premium accessibility contracts: 2 passing. Remove company account: 14 passing (8s). Runner readiness: 1 passing; legacy add_new_user_with_existing_email: 2 passing. Full Core: 805 integration passing, 16 explicitly pending, then 797 unit passing, exit 0. Full Premium: 368 passing (13s), exit 0.
```

## Root cause

Шаблоны не связывали визуальные подписи с controls; action содержал лишний slash; runner не имел явного server-ready handshake, а npm PATH приоритизировал несовместимый chromedriver package.

## Approved fix

Добавлены локализованные aria-label/labels, исправлен route action, внедрён IPC-ready handshake и SE_SKIP_DRIVER_IN_PATH=true; добавлены сфокусированные regression contracts.

**Why this is causal:** Каждое изменение непосредственно устраняет доказанный сигнал: accessibility tree получает имена, POST совпадает с Express route, Selenium стартует после IPC-ready и выбирает совместимый driver через Selenium Manager.

### Production files approved at Gate 2

- [general_settings.hbs](/Users/aleksey/projects/timeoff/views/general_settings.hbs:1) — Контекстные имена Leave Type controls.
- [departments_overview.hbs](/Users/aleksey/projects/timeoff/views/departments_overview.hbs:1) — Имена help и icon-only controls.
- [remove_company_modal.hbs](/Users/aleksey/projects/timeoff/views/partials/remove_company_modal.hbs:1) — Исправленный route удаления.
- [test.js](/Users/aleksey/projects/timeoff/bin/test.js:1) — IPC wait и driver selection environment.
- [wwww](/Users/aleksey/projects/timeoff/bin/wwww:1) — Явный IPC server-ready сигнал.
- [delegation.hbs](/Users/aleksey/projects/timeoff-premium/views/delegation.hbs:1) — Локализованное имя cancel control.
- [deputy_assignments.hbs](/Users/aleksey/projects/timeoff-premium/views/deputy_assignments.hbs:1) — Уникальные labels полей периода.

## Verification

| Check | Status | Evidence |
|---|---|---|
| Focused red-to-green | ✅ passed | Core 5 passing; Premium 2 passing; company deletion 14 passing; readiness 1 passing. |
| Core full system suite | ✅ passed | 805 integration passing, 16 explicitly pending, 797 unit passing, exit 0. |
| Premium full suite | ✅ passed | 368 passing (13s), exit 0; npm run check exit 0. |
| Workbook verification | ✅ passed | 544/544 post-fix Pass, 0 open defects, 0 formula errors, 6 sheets visually inspected. |

## Reproduce

```bash
npx mocha t/unit/settings_accessibility_contract.js t/unit/test_runner_logging.js
```
```bash
npx mocha test/accessibility_contract.test.js
```
```bash
npm test -- --grep 'Remove company account'
```
```bash
npm test
```

## Limitations

- Evidence JSON агрегирует четыре точные сфокусированные команды в один red-to-green набор; это не один shell invocation.
- 16 integration tests имеют явный pending/skip в исходном suite и не являются failures.

## Residual risks

- При будущем обновлении Chrome/npm chromedriver совместимость следует снова подтвердить readiness regression test.

## Notes

- Публичные API и схема данных не изменялись.
- Существующие пользовательские изменения в Core сохранены без перезаписи.

---

Generated by `$bug-reproducer`. A fix is proven only by the same red-to-green reproducer plus relevant broader checks.

# Внешний интегратор TimeOff -> Jira Data Center

Этот интегратор:

1. Читает отсутствия и замещающих из TimeOff API.
2. Ищет задачи отсутствующего сотрудника в Jira DC.
3. Переназначает задачи на замещающего.

## 1. Подготовка

Требования:

1. Node.js 20+
2. Доступ к TimeOff и Jira DC по сети
3. API токен TimeOff
4. Service account в Jira с правами на назначение задач

Перейдите в папку:

```bash
cd integrations/jira-timeoff-worker
```

## 2. Конфигурация

1. Создайте `.env` на основе примера:

```bash
cp .env.example .env
```

2. (Опционально) создайте файл ручного маппинга пользователей:

```bash
cp config/user-map.example.json config/user-map.json
```

3. Заполните `.env`:

1. `TIMEOFF_BASE_URL`
2. `TIMEOFF_TOKEN`
3. `JIRA_BASE_URL`
4. `JIRA_AUTH_MODE` (`basic` или `bearer`)
5. `JIRA_USER` (только для `basic`)
6. `JIRA_TOKEN`
7. `USER_MAPPING_FILE=./config/user-map.json` (опционально)
8. `AUTO_MAP_BY_EMAIL=true` (рекомендуется)

4. Если нужен ручной override, заполните `config/user-map.json`:

```json
{
  "timeoff.email@company.local": "jira.username"
}
```

## 3. Тестовый запуск (dry-run)

По умолчанию `DRY_RUN=true`, то есть Jira не изменяется.

Linux/macOS:

```bash
set -a; source .env; set +a
node index.js
```

PowerShell:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match "^\s*#") { return }
  if ($_ -match "^\s*$") { return }
  $pair = $_ -split "=", 2
  [Environment]::SetEnvironmentVariable($pair[0], $pair[1], "Process")
}
node .\index.js
```

Проверьте в логах:

1. `Issues found for absent employee`
2. `DRY_RUN: would reassign issue`
3. `Sync completed`

## 4. Боевой запуск

1. Установите в `.env`:
   `DRY_RUN=false`
2. Запустите снова:
   `node index.js`

Проверьте в Jira, что assignee задач обновился.

## 5. Запуск по расписанию (cron)

Пример каждые 10 минут:

```bash
*/10 * * * * cd /opt/timeoff/integrations/jira-timeoff-worker && set -a && source .env && set +a && /usr/bin/node index.js >> /var/log/timeoff-jira-worker.log 2>&1
```

## 6. Запуск как systemd service + timer (рекомендуется)

Создайте `/etc/systemd/system/timeoff-jira-worker.service`:

```ini
[Unit]
Description=TimeOff Jira Reassign Worker
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/timeoff/integrations/jira-timeoff-worker
EnvironmentFile=/opt/timeoff/integrations/jira-timeoff-worker/.env
ExecStart=/usr/bin/node /opt/timeoff/integrations/jira-timeoff-worker/index.js
User=timeoff
Group=timeoff
```

Создайте `/etc/systemd/system/timeoff-jira-worker.timer`:

```ini
[Unit]
Description=Run TimeOff Jira Worker every 10 minutes

[Timer]
OnCalendar=*:0/10
Persistent=true

[Install]
WantedBy=timers.target
```

Активируйте:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now timeoff-jira-worker.timer
sudo systemctl status timeoff-jira-worker.timer
```

## 7. Полезные параметры

1. `JIRA_EXTRA_JQL`
   ограничить область задач (проекты/типы/статусы)
2. `TIMEOFF_DATE`
   принудительная дата для теста
3. `TIMEOFF_LEAVE_STATUSES`
   список статусов, например `Approved,New`
4. `JIRA_ASSIGN_FIELD`
   обычно `name` для Jira DC
5. `AUTO_MAP_BY_EMAIL`
   автоматический поиск Jira-пользователя по email из TimeOff
6. `USER_MAPPING_FILE`
   файл ручных соответствий (используется как override для исключений)
7. `MAPPING_REPORT_FILE`
   путь к JSON-отчету по сопоставлению пользователей
8. `MAPPING_NOT_FOUND_THRESHOLD`
   аварийный порог для `summary.byStatus.not_found`; при превышении worker завершится с ошибкой
9. `JIRA_AUTH_MODE`
   `basic` (по умолчанию) или `bearer` (PAT)
10. `ENABLE_AUTO_RESTORE`
   включает автоматический возврат задач на исходного assignee после выхода сотрудника из отпуска
11. `REASSIGN_STATE_FILE`
   путь к файлу состояния переназначений
12. `RESTORE_REPORT_FILE`
   отдельный JSON-отчет по этапу возврата задач

## 8. Диагностика

### Проблема: `Missing required environment variables`

1. Проверьте `.env`.
2. Проверьте, что переменные действительно загружены в процесс.

### Проблема: `TimeOff request failed [401]`

1. Проверить токен.
2. Проверить, что Integration API включен в TimeOff.

### Проблема: `Jira search failed [401/403]`

1. Если в ошибке есть `Basic Authentication has been disabled on this instance`, переключить:
   `JIRA_AUTH_MODE=bearer`
2. Для `bearer` использовать PAT в `JIRA_TOKEN`.
3. Проверить права service account в Jira.

### Проблема: `Skipping absent employee: no Jira mapping`

1. Убедиться, что `AUTO_MAP_BY_EMAIL=true`.
2. Проверить, что email пользователя в TimeOff существует в Jira.
3. Если email не совпадает с Jira username, добавить override в `config/user-map.json`.

## 9. Безопасность

1. Не храните реальные токены в git.
2. Ограничьте доступ к `.env`:

```bash
chmod 600 .env
```

3. Регулярно ротируйте токены и обновляйте `.env`.

## 10.1 Отчет по сопоставлениям (mapping report)

Если задан `MAPPING_REPORT_FILE`, после каждого цикла worker сохраняет JSON с результатами маппинга.

Пример полей:

1. `status`: `resolved` / `not_found` / `error`
2. `source`:
   `override_file`, `auto_user_lookup`, `auto_search_email`, `auto_search_name`, `auto_mapping_not_found`, `auto_mapping_error`
3. `jiraUser`: найденный Jira-идентификатор
4. `summary`:
   агрегаты по `status` и `source` для быстрого контроля качества сопоставления

Это удобно для диагностики и проверки качества авто-сопоставления.

Пример guardrail:

1. `MAPPING_NOT_FOUND_THRESHOLD=0` - не допускается ни одного `not_found`.
2. `MAPPING_NOT_FOUND_THRESHOLD=2` - допускается не более двух неразрешенных пользователей.

## 10.2 Автоматический возврат задач после отпуска

Если `ENABLE_AUTO_RESTORE=true`, worker:

1. запоминает исходного assignee при авто-переназначении на замещающего;
2. после выхода сотрудника из отпуска возвращает задачу обратно исходному assignee.

Безопасность логики:

1. если assignee задачи изменен вручную, worker не перетирает это изменение;
2. задачи в статусе Done не возвращаются и убираются из state;
3. если в текущем цикле есть ошибки маппинга пользователей, этап auto-restore пропускается.

## 11. Запуск через Docker Compose (рекомендуется для вашего проекта)

В репозитории уже добавлен сервис `worker` в `docker-compose.yml`.

### Что подготовить

1. Создать корневой `.env`:

```bash
cp .env.example .env
```

2. Заполнить в `.env`:

1. `TIMEOFF_TOKEN`
2. `JIRA_BASE_URL`
3. `JIRA_AUTH_MODE` (`basic` или `bearer`)
4. `JIRA_TOKEN`
5. `JIRA_USER` (только если `JIRA_AUTH_MODE=basic`)
6. Опционально `JIRA_EXTRA_JQL`
7. Для первого прогона оставить `DRY_RUN=true`

3. Создать файл маппинга:

```bash
cp integrations/jira-timeoff-worker/config/user-map.example.json integrations/jira-timeoff-worker/config/user-map.json
```

### Запуск

```bash
docker compose up -d --build
```

Проверка логов worker:

```bash
docker compose logs -f worker
```

Ожидаемые сообщения:

1. `Starting TimeOff -> Jira sync`
2. `Issues found for absent employee`
3. `Sync completed`

### Перевод в боевой режим

1. Установить в корневом `.env`:
   `DRY_RUN=false`
2. Перезапустить worker:

```bash
docker compose up -d --no-deps worker
```

### Важные замечания

1. Внутри compose TimeOff адрес берется как `http://app:3000` (уже настроено).
2. Интервал запуска задается переменной `WORKER_INTERVAL_SECONDS` (по умолчанию 600 секунд).
3. Файл `user-map.json` подключается в контейнер read-only.
4. Отчет по маппингу сохраняется в `integrations/jira-timeoff-worker/reports/mapping-report.json`.
5. Если сработал порог `MAPPING_NOT_FOUND_THRESHOLD`, контейнер worker завершится с ошибкой и будет перезапущен по `restart: unless-stopped`.
6. Состояние для auto-restore хранится в `integrations/jira-timeoff-worker/reports/reassignment-state.json`.
7. Отчет по возврату задач хранится в `integrations/jira-timeoff-worker/reports/restore-report.json`.

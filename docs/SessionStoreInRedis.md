# Redis как хранилище сессий

По умолчанию приложение может хранить сессии в основной базе данных, в таблице `Sessions`.

Если нужен более типичный корпоративный вариант, можно использовать `Redis`.

## Когда это нужно

- если приложение работает за `docker compose`;
- если сессии не должны храниться в `SQLite` или `MySQL`;
- если нужен сценарий ближе к production;
- если вы хотите переживать перезапуск приложения без странного поведения сессий.

## Вариант 1. Локальный запуск через npm

Откройте `config/app.json` и включите Redis:

```json
"sessionStore": {
  "useRedis": true,
  "redisConnectionConfiguration": {
    "host": "127.0.0.1",
    "port": 6379
  }
}
```

После этого:

1. убедитесь, что Redis запущен;
2. перезапустите приложение;
3. войдите в систему;
4. проверьте наличие ключей:

```bash
redis-cli KEYS 'sess:*'
```

## Вариант 2. Docker Compose

В `docker-compose.yml` Redis уже поднимается автоматически.

Также compose монтирует файл:

```text
./config/app.redis.json:/app/config/app.json
```

Это значит, что внутри контейнера приложение уже работает с конфигом, где:

- `useRedis = true`
- `host = redis`
- `port = 6379`

### Проверка

```bash
docker compose exec redis redis-cli ping
docker compose exec redis redis-cli KEYS 'sess:*'
docker compose logs app
```

Полезная строка в логах приложения:

```text
Connected to redis successfully
```

## Если Redis включён, но ничего не работает

Проверьте:

1. правильный ли конфиг вы редактировали: `app.json` или `app.redis.json`;
2. доступен ли Redis по нужному `host` и `port`;
3. вошли ли вы в приложение, чтобы вообще появилась сессия;
4. нет ли ошибки Redis в логах приложения.

## Связанные документы

- [README](/home/sdigitaladmin/timeoff/README.md)
- [Установка через Docker Compose](/home/sdigitaladmin/timeoff/docs/docker-compose.md)
- [Проверка работы и диагностика](/home/sdigitaladmin/timeoff/docs/verification-and-troubleshooting.md)

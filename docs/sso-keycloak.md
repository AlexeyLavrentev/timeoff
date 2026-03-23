# SSO через Keycloak: OIDC и SAML

Этот проект поддерживает SSO для компании через один активный метод одновременно:

- `OIDC`
- `SAML 2.0`

Важно: одновременно включить оба метода для одной компании нельзя. В интерфейсе выбирается один провайдер SSO, и логин пользователей будет идти только через него.

## Что проверить до настройки

1. У каждого пользователя в приложении уже должен существовать аккаунт с рабочим email.
2. Email в Keycloak должен совпадать с email пользователя в приложении.
3. В `config/app.json` параметр `application_domain` должен указывать на внешний HTTPS-адрес приложения.
4. Если приложение стоит за reverse proxy, наружный URL должен совпадать с тем, который видит пользователь и Keycloak.

Приложение использует эти URL:

- OIDC callback: `/login/sso/callback`
- SAML ACS: `/login/sso/callback/saml`
- SAML metadata: `/login/sso/metadata/saml/<companyId>`

## Вариант 1: Keycloak через OIDC

Это рекомендуемый путь для Keycloak, если нет жёсткого требования использовать именно SAML.

### Что создать в Keycloak

1. Откройте нужный realm.
2. Создайте client типа `OpenID Connect`.
3. Укажите `Client ID`, например `timeoff-management`.
4. Включите Authorization Code Flow (`Standard flow`).
5. Для confidential client сохраните `Client secret`.
6. Добавьте `Valid redirect URIs`:
   - `https://timeoff.example.com/login/sso/callback`
7. Добавьте `Valid post logout redirect URIs`:
   - `https://timeoff.example.com/login/`
8. При необходимости добавьте `Web origins`:
   - `https://timeoff.example.com`

### Что заполнить в приложении

Откройте `Settings -> Authentication -> SSO` и выберите `OIDC`.

Заполните поля так:

- `Enable SSO`: включить
- `SSO provider`: `OIDC`
- `OIDC issuer URL`: `https://keycloak.example.com/realms/<realm>`
- `OIDC client ID`: значение `Client ID` из Keycloak
- `OIDC client secret`: secret из Keycloak для confidential client
- `OIDC scopes`: обычно `openid profile email`
- `OIDC email claim`: обычно `email`
- `Require verified email from OIDC provider`: включайте только если в Keycloak реально выставляется `email_verified=true`

### Как это работает

1. Пользователь вводит рабочий email на странице логина.
2. Приложение определяет компанию пользователя.
3. Если для компании активен OIDC, пользователь перенаправляется в Keycloak.
4. После callback приложение сверяет email из OIDC с email пользователя в локальной базе.

### Типичные ошибки OIDC

- `Issuer URL` указан не на realm, а на корень Keycloak.
  Нужно именно `https://host/realms/<realm>`.
- В `Valid redirect URIs` нет точного callback URL приложения.
- У пользователя в Keycloak нет email, либо claim называется не `email`.
- Включён флаг проверки подтверждённого email, но `email_verified` не приходит или равен `false`.

## Вариант 2: Keycloak через SAML

Используйте этот путь, только если у вас есть требование именно к SAML-интеграции.

### Что создать в Keycloak

1. Откройте нужный realm.
2. Создайте client типа `SAML`.
3. В качестве `Valid redirect URI` или `Master SAML Processing URL` укажите:
   - `https://timeoff.example.com/login/sso/callback/saml`
4. Включите подпись SAML-ответов или assertions.
   Приложение ожидает подписанный ответ от IdP.
5. Экспортируйте публичный сертификат realm или сертификат подписания SAML и вставьте его в приложение как `IdP certificate`.
6. Убедитесь, что в assertion передаётся email пользователя.

### Что заполнить в приложении

Откройте `Settings -> Authentication -> SSO` и выберите `SAML 2.0`.

Заполните поля так:

- `Enable SSO`: включить
- `SSO provider`: `SAML 2.0`
- `SAML entry point`: SSO endpoint Keycloak для realm/client
- `SAML IdP certificate`: сертификат Keycloak в PEM-формате
- `SAML NameID format`: обычно email format, если вы передаёте email как NameID
- `SAML email attribute`: имя атрибута с email, обычно `email`
- `SAML SP entity ID`: можно оставить пустым, тогда приложение использует свой metadata URL как entity ID

### Что взять из приложения для Keycloak

На странице настроек приложение показывает:

- `SAML ACS URL`: его надо использовать как callback/processing URL в Keycloak
- `SAML metadata URL`: его можно использовать как reference для настройки SP entity ID
- `SAML SP entity ID`: если поле пустое, оно равно metadata URL

### Типичные ошибки SAML

- Вставлен не тот сертификат или сертификат без PEM-обрамления.
- Keycloak отправляет неподписанный ответ.
- В assertion нет email, а приложение не может сопоставить пользователя.
- `entry point` указывает не на SAML endpoint Keycloak.
- В Keycloak указан другой ACS URL, чем показывает приложение.

## Что важно понимать про хранение настроек

Приложение хранит один набор SSO-настроек на компанию и переключатель активного метода.

Это значит:

- можно документировать и подготовить оба сценария для Keycloak;
- но в бою для конкретной компании будет активен только один из них;
- при переключении между `OIDC` и `SAML` нужно проверять именно поля выбранного метода.

## Быстрая проверка после настройки

1. Создайте или проверьте пользователя в приложении.
2. Убедитесь, что тот же email есть у пользователя в Keycloak.
3. На странице логина приложения введите этот email.
4. Нажмите `Continue with SSO`.
5. Убедитесь, что происходит redirect в Keycloak.
6. После успешного логина пользователь должен вернуться в приложение уже в авторизованной сессии.

## Если после сохранения настроек возникает ошибка

Проверьте по порядку:

1. Какой метод выбран в поле `SSO provider`.
2. Совпадает ли внешний URL приложения с `application_domain`.
3. Для OIDC: realm issuer, redirect URI, client ID, client secret.
4. Для SAML: ACS URL, signing certificate, email attribute, подписанный response/assertion.
5. Что email в приложении и в Keycloak идентичны.

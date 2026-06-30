#!/bin/bash

# Скрипт для инициализации Keycloak для LeavePilot тестирования
# Создаёт realm, client и тестового пользователя

set -e

KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin"
REALM_NAME="leavepilot"
CLIENT_ID="leavepilot"
CLIENT_SECRET="leavepilot-secret"
REDIRECT_URI="http://localhost:3000/login/sso/callback"

echo "⏳ Ожидание запуска Keycloak..."
until curl -s "$KEYCLOAK_URL/health/ready" > /dev/null; do
  echo "   Keycloak ещё не готов, ожидание..."
  sleep 2
done
echo "✅ Keycloak готов!"

# Получаем токен администратора
echo "🔑 Получение admin токена..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER&password=$ADMIN_PASSWORD&grant_type=client_credentials&client_id=admin-cli" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  echo "❌ Не удалось получить admin токен"
  exit 1
fi
echo "✅ Admin токен получен"

# Создаём realm
echo "🏰 Создание realm '$REALM_NAME'..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "'$REALM_NAME'",
    "enabled": true,
    "displayName": "LeavePilot Test Realm",
    "sslRequired": "external",
    "registrationAllowed": true,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": true,
    "bruteForceProtected": false
  }' > /dev/null
echo "✅ Realm создан"

# Создаём client
echo "🔧 Создание OIDC client '$CLIENT_ID'..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'$CLIENT_ID'",
    "name": "LeavePilot",
    "description": "LeavePilot Test Application",
    "enabled": true,
    "clientAuthenticatorType": "client-secret",
    "secret": "'$CLIENT_SECRET'",
    "redirectUris": ["'$REDIRECT_URI'"],
    "webOrigins": ["http://localhost:3000"],
    "protocol": "openid-connect",
    "publicClient": false,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": false,
    "serviceAccountsEnabled": false,
    "attributes": {
      "post.logout.redirect.uris": "+"
    }
  }' > /dev/null
echo "✅ Client создан"

# Создаём тестового пользователя
echo "👤 Создание тестового пользователя..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User",
    "email": "testuser@leavepilot.test",
    "enabled": true,
    "emailVerified": true,
    "attributes": {
      "locale": ["en"]
    }
  }' > /dev/null

# Устанавливаем пароль для пользователя
USER_ID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users?username=testuser" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users/$USER_ID/reset-password" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "password",
    "value": "Test123456!",
    "temporary": false
  }' > /dev/null
echo "✅ Пользователь создан"

echo ""
echo "🎉 Keycloak настроен успешно!"
echo ""
echo "📋 Детали подключения:"
echo "   Realm: $REALM_NAME"
echo "   Client ID: $CLIENT_ID"
echo "   Client Secret: $CLIENT_SECRET"
echo "   Redirect URI: $REDIRECT_URI"
echo ""
echo "👤 Тестовый пользователь:"
echo "   Username: testuser"
echo "   Password: Test123456!"
echo "   Email: testuser@leavepilot.test"
echo ""
echo "🌐 URLs:"
echo "   Keycloak Console: $KEYCLOAK_URL/admin"
echo "   Realm: $KEYCLOAK_URL/realms/$REALM_NAME"
echo ""

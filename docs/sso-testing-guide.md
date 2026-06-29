# SSO Testing Guide: Keycloak

## Quick Start with Docker

This guide helps you test LeavePilot SSO integration with Keycloak using Docker.

### Step 1: Start Keycloak

```bash
docker run -d \
  --name keycloak \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:25.0 \
  start-dev
```

Wait for Keycloak to start (~30 seconds).

### Step 2: Access Keycloak Admin Console

```
URL: http://localhost:8080
Username: admin
Password: admin
```

### Step 3: Create Realm

1. Hover over the dropdown in top-left corner
2. Click "Create Realm"
3. Name: `leavepilot-test`
4. Click "Create"

### Step 4: Configure OIDC Client

#### Option A: OIDC (Recommended)

1. Go to: **Clients** → **Create client**
2. Fill in:
   - Client type: `OpenID Connect`
   - Client ID: `leavepilot`
   - Click **Next**
3. Client authentication: **ON** (confidential client)
4. Click **Next**
5. Valid redirect URIs:
   ```
   http://localhost:3000/login/sso/callback
   https://your-domain.com/login/sso/callback
   ```
6. Valid post logout redirect URIs:
   ```
   http://localhost:3000/login/
   https://your-domain.com/login/
   ```
7. Web origins:
   ```
   http://localhost:3000
   https://your-domain.com
   ```
8. Click **Save**

#### Option B: SAML 2.0

1. Go to: **Clients** → **Create client**
2. Fill in:
   - Client type: `SAML`
   - Client ID: `leavepilot-saml`
   - Click **Next**
3. Valid redirect URIs:
   ```
   http://localhost:3000/login/sso/callback/saml
   https://your-domain.com/login/sso/callback/saml
   ```
4. Valid post logout redirect URIs:
   ```
   http://localhost:3000/login/
   https://your-domain.com/login/
   ```
5. Click **Save**

6. In client settings, enable:
   - **Signature** = ON
   - **Client signature required** = ON
   - **Force POST binding** = ON

### Step 5: Get Required Values

#### For OIDC:
- **Issuer URL**: `http://localhost:8080/realms/leavepilot-test`
- **Client ID**: `leavepilot`
- **Client Secret**: Go to **Clients** → **leavepilot** → **Credentials** tab

#### For SAML:
- **Entry Point**: `http://localhost:8080/realms/leavepilot-test/protocol/saml`
- **IdP Certificate**: Go to **Realm Settings** → **Keys** → **RS256** → **Certificate**

### Step 6: Configure LeavePilot

1. Go to LeavePilot: **Settings** → **Authentication** → **SSO**
2. Fill in:

For OIDC:
```
Enable SSO: ON
SSO provider: OIDC
OIDC issuer URL: http://localhost:8080/realms/leavepilot-test
OIDC client ID: leavepilot
OIDC client secret: [copy from Keycloak]
OIDC scopes: openid profile email
OIDC email claim: email
SSO email domains: example.com
Allow automatic user provisioning: ON
Require verified email: OFF (for testing)
```

For SAML:
```
Enable SSO: ON
SSO provider: SAML 2.0
SAML entry point: http://localhost:8080/realms/leavepilot-test/protocol/saml
SAML IdP certificate: [copy from Keycloak]
SAML email attribute: email
SSO email domains: example.com
Allow automatic user provisioning: ON
```

### Step 7: Create Test User in Keycloak

1. Go to: **Users** → **Add user**
2. Fill in:
   - Username: `testuser`
   - Email: `testuser@example.com`
   - Email verified: ON
   - Click **Create**
3. Go to **Credentials** tab
4. Set password: `testpass`
5. Set **Temporary** to OFF
6. Click **Set password**

### Step 8: Test Login

1. Open LeavePilot: `http://localhost:3000/login/`
2. Click **"Continue with SSO"**
3. You should be redirected to Keycloak
4. Login with: `testuser` / `testpass`
5. You should be redirected back to LeavePilot, logged in

---

## Test Scenarios

### Scenario 1: Successful Login (OIDC)
```
Expected: User redirected to Keycloak, authenticates, redirected back
Status: PASS | FAIL
Notes:
```

### Scenario 2: Successful Login (SAML)
```
Expected: User redirected via SAML, authenticates, redirected back
Status: PASS | FAIL
Notes:
```

### Scenario 3: Auto-Provisioning
```
Expected: New user created automatically on first login
Status: PASS | FAIL
Notes:
```

### Scenario 4: Existing User Login
```
Expected: Existing user matched by email, logged in
Status: PASS | FAIL
Notes:
```

### Scenario 5: Wrong Email Domain
```
Expected: Error or company selection prompt
Status: PASS | FAIL
Notes:
```

### Scenario 6: Invalid Certificate (SAML)
```
Expected: Clear error message about certificate
Status: PASS | FAIL
Notes:
```

### Scenario 7: Logout
```
Expected: User logged out from both LeavePilot and Keycloak
Status: PASS | FAIL
Notes:
```

---

## Common Issues and Solutions

### Issue 1: "Issuer discovery failed"

**Cause:** Invalid issuer URL

**Solution:**
- Ensure URL ends with realm name: `http://localhost:8080/realms/leavepilot-test`
- NOT just `http://localhost:8080`
- Check Keycloak is running: `docker ps | grep keycloak`

### Issue 2: "Invalid redirect URI"

**Cause:** Mismatch between Keycloak and LeavePilot

**Solution:**
- Ensure redirect URIs in Keycloak match exactly:
  - `http://localhost:3000/login/sso/callback` (OIDC)
  - `http://localhost:3000/login/sso/callback/saml` (SAML)
- Check for trailing slashes or protocol mismatches

### Issue 3: "Certificate validation failed"

**Cause:** Invalid or missing SAML certificate

**Solution:**
- Copy certificate from: **Realm Settings** → **Keys** → **Certificate**
- Ensure PEM format: `-----BEGIN CERTIFICATE-----`
- Try with and without line breaks

### Issue 4: "User not found"

**Cause:** Auto-provisioning disabled, user doesn't exist

**Solution:**
- Enable **Allow automatic user provisioning** in SSO settings
- OR create user manually in LeavePilot with same email

### Issue 5: "Email claim not found"

**Cause:** Keycloak not sending email attribute

**Solution:**
- Check user has email in Keycloak
- Verify **Email verified** is ON
- Check **Client scopes** → **email** is assigned to client

### Issue 6: "Signature validation failed" (SAML)

**Cause:** Signature not configured properly

**Solution:**
- Enable **Signature** in Keycloak client settings
- Ensure **Client signature required** is ON
- Copy correct certificate

---

## Testing Checklist

Before considering SSO integration complete:

- [ ] Test OIDC login with valid credentials
- [ ] Test SAML login with valid credentials
- [ ] Test auto-provisioning creates new user
- [ ] Test existing user can login
- [ ] Test logout redirects correctly
- [ ] Test error messages are user-friendly
- [ ] Test with different email domains
- [ ] Test with expired/invalid certificate
- [ ] Test with wrong issuer URL
- [ ] Verify session works after login
- [ ] Verify user profile data synced correctly

---

## Production Configuration Notes

When moving to production:

1. **Use HTTPS** for all URLs
2. **Use real certificates** from production IdP
3. **Configure proper email domains** from your organization
4. **Test auto-provisioning** carefully in staging first
5. **Review logout behavior** for single sign-out
6. **Monitor error logs** for SSO-related issues
7. **Keep backup** of working configuration

---

## Debug Mode

To enable verbose SSO logging for troubleshooting:

```javascript
// In .env or config
SSO_DEBUG=true
SSO_LOG_LEVEL=verbose
```

This will log:
- All SSO requests/responses
- IdP communication details
- Token payloads (sanitized)
- Validation steps

**WARNING:** Never enable debug mode in production as it may log sensitive data.

---

## Need Help?

If you encounter issues not covered here:

1. Check application logs: `docker logs leavepilot-app`
2. Check Keycloak logs: `docker logs keycloak`
3. Review [SSO documentation](sso-keycloak.md)
4. Create issue on GitHub with:
   - SSO provider (OIDC/SAML)
   - Error messages
   - Relevant logs (sanitized)
   - Configuration details (sanitized)

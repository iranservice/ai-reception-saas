# Auth.js Google OAuth Local Smoke-Test Runbook

## Status

Operational runbook for local/manual smoke testing.

## Audience

Operators and developers validating Google OAuth setup locally or in a non-production environment.

## Scope

- Local smoke-test only
- No production rollout
- No automated E2E test
- No source code changes
- No committed secrets
- No middleware
- No request-context integration
- No tenant/authz validation

---

## Prerequisites

Before starting, ensure:

1. **Repository checked out** — `ai-reception-saas` cloned locally.
2. **Dependencies installed** — run `pnpm install`.
3. **Database available** — PostgreSQL running and `DATABASE_URL` configured (required when Auth.js runtime is enabled, as the Prisma adapter is initialized).
4. **Prisma client generated** — run `pnpm prisma:generate`.
5. **Local environment variable mechanism available** — `.env.local` or shell-level exports (never `.env` committed to source control).
6. **Access to a Google Cloud project** — with permission to create OAuth 2.0 credentials.
7. **App can run locally** — `pnpm dev` starts on `http://localhost:3000`.

---

## Current Auth Route

| Item | Value |
|---|---|
| Auth.js route | `/api/auth/[...nextauth]` |
| Supported methods | `GET`, `POST` |
| Google callback path | `/api/auth/callback/google` |
| Local callback URL | `http://localhost:3000/api/auth/callback/google` |
| Session strategy | JWT (no database sessions) |
| Default state | Disabled (returns 501) |

> **Note:** If your local app runs on a port other than 3000, replace `3000` with your actual port in all URLs throughout this runbook.

---

## Google Cloud Console Setup

### Step 1: Open Google Cloud Console

Navigate to [https://console.cloud.google.com/](https://console.cloud.google.com/).

### Step 2: Select or create a project

- Use an existing project, or create a new one for development/testing.
- The project does not need to be the production project.

### Step 3: Configure OAuth consent screen (if required)

1. Go to **APIs & Services → OAuth consent screen**.
2. Select **External** user type (or Internal if using Google Workspace).
3. Fill in required fields:
   - App name: any name (e.g. `ai-reception-saas-dev`)
   - User support email: your email
   - Developer contact: your email
4. Add scopes: `email`, `profile`, `openid`.
5. Save.

> **Note:** For testing purposes, you can remain in "Testing" publishing status. Only users you add as test users will be able to sign in.

### Step 4: Create OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: any descriptive name (e.g. `ai-reception-saas-local`).
5. Under **Authorized redirect URIs**, add:

```
http://localhost:3000/api/auth/callback/google
```

6. Click **Create**.

### Step 5: Copy credentials

- Copy the **Client ID** (looks like `xxxx.apps.googleusercontent.com`).
- Copy the **Client Secret**.

### Step 6: Store secrets securely

- **Do not** commit credentials to the repository.
- **Do not** paste credentials into docs, PRs, screenshots, logs, or chat.
- **Do not** add credentials to `.env` files that are tracked by git.
- Store credentials in `.env.local` (which is gitignored) or export them in your shell session.

---

## Local Environment Variables

Set the following environment variables. Use `.env.local` or shell exports:

```env
# Auth.js runtime gate — exact "true" required
ENABLE_AUTHJS_RUNTIME=true

# Google provider gate — exact "true" required
ENABLE_AUTHJS_GOOGLE_PROVIDER=true

# Auth.js JWT signing secret — must be at least 32 characters
# Generate with: openssl rand -base64 32
AUTH_SECRET=<local-secret-at-least-32-chars>

# Google OAuth credentials from Cloud Console
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-client-secret>
```

### Variable Reference

| Variable | Required When | Semantics | Example |
|---|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` | Always (to enable auth) | Exact `"true"` only | `true` |
| `ENABLE_AUTHJS_GOOGLE_PROVIDER` | To enable Google provider | Exact `"true"` only | `true` |
| `AUTH_SECRET` | `ENABLE_AUTHJS_RUNTIME=true` | Non-empty string, ≥32 chars | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Both flags `"true"` | Google OAuth client ID | `xxxx.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | Both flags `"true"` | Google OAuth client secret | `GOCSPx-xxxx` |

### Flag Strictness

> **IMPORTANT:** Only the exact string `"true"` enables each flag. The following values are all treated as **disabled**:
> - `"TRUE"` — rejected (case-sensitive)
> - `"True"` — rejected
> - `"1"` — rejected (no numeric truthy)
> - `"yes"` — rejected
> - `" true "` — rejected (no trimming)

---

## Smoke-Test Scenarios

### Scenario 1: Runtime Disabled (Default State)

**Environment:**

```env
# ENABLE_AUTHJS_RUNTIME is not set or set to anything other than "true"
# All other auth variables are irrelevant
```

**Steps:**

1. Start the app: `pnpm dev`
2. Open browser or curl: `http://localhost:3000/api/auth/session`

**Expected result:**

```json
{
  "ok": false,
  "error": {
    "code": "AUTHJS_RUNTIME_DISABLED",
    "message": "Auth.js runtime is disabled."
  }
}
```

- HTTP status: **501**
- Content-Type: `application/json`
- No database connection attempted
- No Google provider initialization

---

### Scenario 2: Runtime Enabled, Provider Disabled

**Environment:**

```env
ENABLE_AUTHJS_RUNTIME=true
AUTH_SECRET=my-local-test-secret-at-least-32-characters-long
# ENABLE_AUTHJS_GOOGLE_PROVIDER is not set
```

**Steps:**

1. Start the app: `pnpm dev`
2. Open browser: `http://localhost:3000/api/auth/session`

**Expected result:**

- Auth.js runtime initializes with empty providers array.
- Session endpoint returns Auth.js response (likely `null` session or empty session JSON).
- No Google sign-in button or Google flow available.
- No error from missing Google credentials.

---

### Scenario 3: Runtime Enabled, Provider Enabled, Missing Google Credentials

**Environment:**

```env
ENABLE_AUTHJS_RUNTIME=true
ENABLE_AUTHJS_GOOGLE_PROVIDER=true
AUTH_SECRET=my-local-test-secret-at-least-32-characters-long
# AUTH_GOOGLE_ID is not set
# AUTH_GOOGLE_SECRET is not set
```

**Steps:**

1. Start the app: `pnpm dev`
2. Open browser: `http://localhost:3000/api/auth/session`

**Expected result:**

- The route handler throws an error during initialization:
  `AUTH_GOOGLE_ID is required when ENABLE_AUTHJS_GOOGLE_PROVIDER is enabled.`
- The error occurs **before** Prisma/database initialization (fail-fast ordering).
- The app may show an error page or 500 response depending on Next.js error handling.

---

### Scenario 4: Full Google OAuth Smoke-Test

**Environment:**

```env
ENABLE_AUTHJS_RUNTIME=true
ENABLE_AUTHJS_GOOGLE_PROVIDER=true
AUTH_SECRET=my-local-test-secret-at-least-32-characters-long
AUTH_GOOGLE_ID=your-google-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-google-client-secret
```

**Steps:**

1. Start the app: `pnpm dev`
2. Verify session endpoint: `http://localhost:3000/api/auth/session`
   - Should return session JSON (likely `null` session if not signed in).
3. Navigate to sign-in: `http://localhost:3000/api/auth/signin`
   - Should show Auth.js default sign-in page with a Google button.
4. Click the Google button.
   - Browser redirects to Google's OAuth consent screen.
   - Sign in with a Google account that is listed as a test user (if consent screen is in Testing mode).
5. After Google consent, browser redirects back to:
   `http://localhost:3000/api/auth/callback/google`
6. Verify session: `http://localhost:3000/api/auth/session`
   - Should return session JSON with user information (email, name, image).

**Success criteria:**

- Google sign-in redirects work end-to-end.
- Callback processes without error.
- Session contains user data after sign-in.
- No secrets leaked to logs (check terminal output).

---

### Scenario 5: Kill-Switch Verification

**Steps:**

1. Complete Scenario 4 (successfully signed in).
2. Stop the dev server.
3. Remove or unset `ENABLE_AUTHJS_RUNTIME`:
   ```bash
   unset ENABLE_AUTHJS_RUNTIME
   ```
4. Restart the app: `pnpm dev`
5. Visit: `http://localhost:3000/api/auth/session`

**Expected result:**

- HTTP status: **501**
- Response body:
  ```json
  {
    "ok": false,
    "error": {
      "code": "AUTHJS_RUNTIME_DISABLED",
      "message": "Auth.js runtime is disabled."
    }
  }
  ```
- Auth.js runtime is fully disabled even though Google credentials remain in the environment.

---

## Troubleshooting

### Error: `AUTH_SECRET is required`

**Cause:** `ENABLE_AUTHJS_RUNTIME=true` but `AUTH_SECRET` is missing or empty.

**Fix:** Set `AUTH_SECRET` to a string of at least 32 characters. Generate with:

```bash
openssl rand -base64 32
```

### Error: `AUTH_GOOGLE_ID is required when ENABLE_AUTHJS_GOOGLE_PROVIDER is enabled`

**Cause:** `ENABLE_AUTHJS_GOOGLE_PROVIDER=true` but `AUTH_GOOGLE_ID` is missing or empty.

**Fix:** Set `AUTH_GOOGLE_ID` to the Client ID from Google Cloud Console.

### Error: `AUTH_GOOGLE_SECRET is required when ENABLE_AUTHJS_GOOGLE_PROVIDER is enabled`

**Cause:** `ENABLE_AUTHJS_GOOGLE_PROVIDER=true` but `AUTH_GOOGLE_SECRET` is missing or empty.

**Fix:** Set `AUTH_GOOGLE_SECRET` to the Client Secret from Google Cloud Console.

### Google consent screen shows "Access blocked" or "App not verified"

**Cause:** OAuth consent screen is in Testing mode and the Google account is not listed as a test user.

**Fix:** Add the Google account as a test user in **APIs & Services → OAuth consent screen → Test users**.

### Callback returns "redirect_uri_mismatch"

**Cause:** The redirect URI configured in Google Cloud Console does not match the actual callback URL.

**Fix:** Ensure the authorized redirect URI in Google Cloud Console is exactly:

```
http://localhost:3000/api/auth/callback/google
```

If using a different port, update accordingly.

### Session endpoint returns `null` after sign-in

**Cause:** May indicate a callback processing error, adapter issue, or JWT encoding problem.

**Fix:**
1. Check terminal logs for errors.
2. Ensure `DATABASE_URL` is set and the database is reachable.
3. Ensure Prisma migrations are applied: `pnpm prisma:migrate`.

---

## Security Reminders

- **Never commit secrets** to the repository.
- **Never share credentials** in PRs, issues, Slack, email, or documentation.
- **Use `.env.local`** for local development (gitignored by default).
- **Rotate credentials** if they are accidentally exposed.
- **Use separate credentials** for local development and production.
- **Delete test OAuth clients** from Google Cloud Console when no longer needed.

---

## References

| Resource | URL |
|---|---|
| Auth.js Google Provider docs | [https://authjs.dev/getting-started/providers/google](https://authjs.dev/getting-started/providers/google) |
| Google OAuth 2.0 Web Server docs | [https://developers.google.com/identity/protocols/oauth2/web-server](https://developers.google.com/identity/protocols/oauth2/web-server) |
| Google Cloud Console | [https://console.cloud.google.com/](https://console.cloud.google.com/) |
| Provider environment contract | `docs/architecture/authjs-provider-environment-contract.md` |
| TASK-0036 checkpoint | `docs/checkpoints/TASK-0036-google-provider-configuration-feature-flag.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-15 | Initial runbook — TASK-0037 |

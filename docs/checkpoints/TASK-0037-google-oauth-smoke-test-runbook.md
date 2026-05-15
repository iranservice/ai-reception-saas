# TASK-0037: Local Auth.js Google OAuth Smoke-Test Documentation and Operator Runbook

## Summary

Documentation-only task creating an operator runbook for locally smoke-testing Auth.js Google OAuth. The runbook provides step-by-step instructions for configuring Google Cloud Console credentials, setting local environment variables, running 5 smoke-test scenarios, and troubleshooting common issues. No source code, configuration, or runtime behavior was modified.

## Files Created

- `docs/operations/authjs-google-oauth-smoke-test-runbook.md` — operator runbook
- `docs/checkpoints/TASK-0037-google-oauth-smoke-test-runbook.md` — this file

## Files Modified

None. This is a documentation-only task.

## Runbook Contents

### Smoke-Test Scenarios

| # | Scenario | Environment | Expected Result |
|---|---|---|---|
| 1 | Runtime disabled (default) | No auth flags set | 501 structured JSON |
| 2 | Runtime enabled, provider disabled | `ENABLE_AUTHJS_RUNTIME=true` only | Auth.js with empty providers, no Google flow |
| 3 | Runtime enabled, provider enabled, missing creds | Both flags `"true"`, no Google env | Fail-fast error before DB connection |
| 4 | Full Google OAuth smoke-test | Both flags `"true"`, valid Google env | End-to-end Google sign-in flow |
| 5 | Kill-switch verification | After sign-in, disable runtime | 501 immediately, runtime fully disabled |

### Documented Operator Steps

- Google Cloud Console project selection/creation
- OAuth consent screen configuration
- OAuth 2.0 Client ID creation (Web application type)
- Authorized redirect URI setup (`http://localhost:3000/api/auth/callback/google`)
- Credential copy and secure storage
- Local environment variable setup (`.env.local` or shell exports)
- Flag strictness rules (exact `"true"` only)
- `AUTH_SECRET` generation (`openssl rand -base64 32`)

### Troubleshooting Guide

- Missing `AUTH_SECRET`
- Missing `AUTH_GOOGLE_ID`
- Missing `AUTH_GOOGLE_SECRET`
- Google consent screen access blocked
- Redirect URI mismatch
- Null session after sign-in

### Security Reminders

- Never commit secrets
- Never share credentials in PRs/issues/chat
- Use `.env.local` (gitignored)
- Rotate if exposed
- Use separate credentials for dev/prod
- Delete unused test OAuth clients

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 5 warnings) |
| `pnpm test` | ✅ 769 passed, 7 skipped |
| `pnpm build` | ✅ |

## Scope Confirmation

- ✅ No source code changes
- ✅ No package.json changes
- ✅ No lockfile changes
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No env file changes
- ✅ No secrets committed
- ✅ No middleware
- ✅ No UI
- ✅ No route changes
- ✅ No test changes
- ✅ No workflow changes
- ✅ No domain service changes
- ✅ No adapter changes

## Decision

Accepted local Google OAuth smoke-test runbook; production rollout, UI, middleware, and request-context integration remain deferred.

## Recommended Next Task

[Phase 2] TASK-0038: Auth.js request-context resolver design for provider-backed sessions

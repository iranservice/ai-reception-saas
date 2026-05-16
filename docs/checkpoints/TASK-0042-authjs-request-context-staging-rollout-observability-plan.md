# TASK-0042 — Auth.js Request-Context Staging Rollout Checklist and Observability Plan

| Field | Value |
|---|---|
| Task ID | TASK-0042 |
| Title | Auth.js request-context staging rollout checklist and observability plan |
| Status | Complete |
| Branch | task-0042-authjs-request-context-staging-rollout-observability-plan |
| Baseline | PR #46 merged (6fea154) |
| Scope | Documentation only |

## Summary

Creates a staging rollout checklist and observability plan for enabling Auth.js request-context resolution for protected API handlers. Defines feature flag dependencies, environment variable requirements, a 4-stage rollout procedure (baseline → runtime → Google OAuth → request-context), pre-rollout checklist, per-stage validation steps, error contract reference, observability guidance, and rollback procedures. No source code, tests, or runtime behavior changes.

## Documents Created

| File | Purpose |
|---|---|
| `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` | [NEW] Operations plan |
| `docs/checkpoints/TASK-0042-authjs-request-context-staging-rollout-observability-plan.md` | [NEW] Checkpoint |

## Plan Contents

### Rollout Stages

| Stage | Flag | Action |
|---|---|---|
| Stage 0 | All off | Baseline — verify 501 on auth routes |
| Stage 1 | `ENABLE_AUTHJS_RUNTIME=true` | Auth.js route runtime — verify session endpoint |
| Stage 2 | `ENABLE_AUTHJS_GOOGLE_PROVIDER=true` | Google OAuth — verify end-to-end sign-in |
| Stage 3 | `ENABLE_AUTHJS_REQUEST_CONTEXT=true` | Request-context adapter — verify protected handlers |

### Pre-Rollout Checklist Covers

- Code readiness (all checks passing, smoke tests green)
- Infrastructure readiness (database migration, tables, PostgreSQL access)
- Google OAuth readiness (consent screen, credentials, redirect URI)
- Staging data readiness (test user, test business, active membership)
- Operational readiness (rollback owner, logs access, incident channel)

### Observability Covers

- HTTP error code monitoring (501/401/400/403)
- Auth.js callback error detection
- Database connection failure detection
- JWT decode error detection
- Manual validation procedures per stage
- Future observability task recommendations

### Rollback Procedure Covers

- Flag-based immediate rollback per stage
- Impact analysis per flag
- Data impact assessment (no data loss)

## Files Not Changed

- Source code (no runtime changes)
- Tests
- package.json / pnpm-lock.yaml
- prisma/schema.prisma / prisma/migrations/*
- env files
- middleware
- UI
- domain services / repository layer
- authz policy

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 10 warnings) |
| `pnpm test` | ✅ 844 passed, 7 skipped |
| `pnpm build` | ✅ |

## Decision

Accepted Auth.js request-context staging rollout checklist and observability plan; no runtime changes, documentation-only task.

## Recommended Next Task

[Phase 3] TASK-0043: Execute Auth.js request-context staging rollout using the approved plan.

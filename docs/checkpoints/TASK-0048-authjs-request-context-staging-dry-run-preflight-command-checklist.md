# TASK-0048 — Auth.js Request-Context Staging Dry-Run Preflight Command Checklist

| Field | Value |
|---|---|
| Task ID | TASK-0048 |
| Title | Auth.js request-context staging dry-run preflight command checklist |
| Status | Complete |
| Branch | task-0048-authjs-request-context-staging-dry-run-preflight-command-checklist |
| Baseline | PR #52 merged (302ab56) |
| Scope | Documentation only |

## Summary

Adds a documentation-only preflight command checklist for operators to use before starting a future Auth.js request-context staging dry-run. Defines required variables, safety rules, and 9 preflight check sections with exact commands (bash, curl, SQL), checklists, and a summary table. No source code, tests, scripts, or runtime behavior changes.

## Files Created

| File | Purpose |
|---|---|
| `docs/operations/authjs-request-context-staging-dry-run-preflight-command-checklist.md` | [NEW] Preflight command checklist |
| `docs/checkpoints/TASK-0048-authjs-request-context-staging-dry-run-preflight-command-checklist.md` | [NEW] Checkpoint |

## Files Modified

None.

## Checklist Coverage

| Section | Content |
|---|---|
| Safety Rules | 9 rules (no secrets, no production, no flags without approval) |
| Required Variables | 6 env placeholders |
| Preflight 1 — Local Repository | Git commit verification, 7 local checks |
| Preflight 2 — Staging Deployment | Reachability, deployed commit |
| Preflight 3 — Feature Flag Baseline | 4 flags verified off, session disabled |
| Preflight 4 — Database / Schema | 5 SQL queries (tables, columns, test data) |
| Preflight 5 — OAuth Readiness | Redirect URI, 3 secrets configured |
| Preflight 6 — Rollback Readiness | Owner, channel, flag path, timing |
| Preflight 7 — Evidence Readiness | Template copy, checklist, storage |
| Preflight 8 — Protected Handler Baseline | 2 curl commands verifying disabled state |
| Preflight 9 — Connectivity and Access | Logs, DB, deployment console access |
| Preflight Summary | 9-row summary table with overall result |

## Scope Confirmation

- Documentation only
- Preflight command checklist only
- No dry-run executed
- No validation executed
- No rollout executed
- No runtime behavior changes
- No feature flag changes
- No middleware
- No UI
- No logging implementation
- No metrics implementation
- No package changes
- No lockfile changes
- No env file changes
- No Prisma schema changes
- No migrations
- No domain service changes
- No authz policy changes
- No new scripts
- Internal Session unchanged
- JWT strategy remains

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

## Issues Found

None.

## Decision

Accepted Auth.js request-context staging dry-run preflight command checklist; dry-run execution, rollout changes, middleware, UI, and instrumentation remain deferred.

## Recommended Next Task

[Phase 3] TASK-0049: Execute Auth.js request-context staging dry-run using approved operator packet and preflight checklist.

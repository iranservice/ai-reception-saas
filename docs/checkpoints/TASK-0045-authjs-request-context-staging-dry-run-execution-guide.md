# TASK-0045 — Auth.js Request-Context Staging Dry-Run Execution Guide

| Field | Value |
|---|---|
| Task ID | TASK-0045 |
| Title | Auth.js request-context staging dry-run execution guide |
| Status | Complete |
| Branch | task-0045-authjs-request-context-staging-dry-run-execution-guide |
| Baseline | PR #49 merged (985cdb7) |
| Scope | Documentation only |

## Summary

Adds a documentation-only execution guide for operators performing the Auth.js request-context staging dry-run. Defines required inputs, operator safety rules, execution overview, pre-execution gate, evidence pack setup, per-stage procedures (Stage 0–4) with exact curl commands and gates, post-execution steps, rollback quick reference, and troubleshooting guide. No source code, tests, or runtime behavior changes.

## Files Created

| File | Purpose |
|---|---|
| `docs/operations/authjs-request-context-staging-dry-run-execution-guide.md` | [NEW] Execution guide |
| `docs/checkpoints/TASK-0045-authjs-request-context-staging-dry-run-execution-guide.md` | [NEW] Checkpoint |

## Files Modified

None.

## Guide Contents

| Section | Purpose |
|---|---|
| Required Inputs Before Execution | 17 required inputs with sources |
| Operator Safety Rules | 10 safety rules |
| Execution Overview | 13-step high-level flow |
| Pre-Execution Gate | 15 gate items |
| Evidence Pack Setup | Duplication and storage instructions |
| Stage 0 — Baseline Execution | Flags, curl commands, gate |
| Stage 1 — Runtime Execution | Flag change, env, curl commands, gate |
| Stage 2 — Google Provider Execution | OAuth flow, DB verification, gate |
| Stage 3 — Request-Context Execution | Auth, tenant, negative, kill-switch, gate |
| Stage 4 — Staging Soak Execution | Monitoring schedule, soak exit gate |
| Post-Execution Steps | Evidence completion, sign-off, review submission |
| Rollback Quick Reference | Per-stage rollback table, steps, data safety |
| Troubleshooting Quick Reference | 9 symptoms with causes and resolutions |

## Scope Confirmation

- Documentation only
- Guide only
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

Accepted Auth.js request-context staging dry-run execution guide; dry-run execution, rollout changes, middleware, UI, and instrumentation remain deferred.

## Recommended Next Task

[Phase 3] TASK-0046: Execute Auth.js request-context staging dry-run using approved guide and evidence template.

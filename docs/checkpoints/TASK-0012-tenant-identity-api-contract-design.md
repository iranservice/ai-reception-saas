# TASK-0012: Tenant and Identity API Contract Design

## Summary

Designed the complete HTTP API contracts for tenant, identity, membership, session, authorization, and audit flows. This task is documentation only — no API routes, handlers, middleware, auth runtime, or UI were implemented.

All contracts are derived from the accepted domain types, validation schemas, service interfaces, and repository implementations in `src/domains/`.

---

## Files Created

| File | Purpose |
|---|---|
| `docs/api/tenant-identity-api-contracts.md` | Main API contract design: endpoint groups, request/response shapes, route params, validation rules, audit rules |
| `docs/api/api-error-contracts.md` | Error envelope, HTTP status mapping, domain error groups, security/validation/repository/audit error policies |
| `docs/api/api-authz-contracts.md` | Server-side authorization flow, route authorization matrix, tenant context contract, denial behavior |
| `docs/checkpoints/TASK-0012-tenant-identity-api-contract-design.md` | This checkpoint |

## Files Modified

None. No existing files were modified.

---

## API Contract Decisions

- **Response envelope** uses `ActionResult<T>` shape: `{ ok: true, data: T }` or `{ ok: false, error: { code, message } }`.
- **Route params take precedence** over body fields for trusted values (`businessId`, `membershipId`).
- **`createdByUserId` and `invitedByUserId`** are resolved server-side from authenticated user — never accepted from client.
- **Audit events** are required for mutations on businesses, memberships, and role changes.
- **Session endpoints** are designed as contract-only — actual session mechanics depend on auth provider selection (open question).
- **`PATCH /api/identity/me`** does not accept `status` changes — admin-level status changes are deferred.
- **Audit event listing** enforces a maximum of 100 events per request (default: 50), matching repository implementation.

## Error Contract Decisions

- **Generic input errors** returned to client (e.g., `INVALID_IDENTITY_INPUT`) — no field-level errors in MVP.
- **Security-first error policy**: `TENANT_ACCESS_DENIED` (403) returned instead of `BUSINESS_NOT_FOUND` (404) for inaccessible resources to prevent resource enumeration.
- **Repository errors** map to 500 with generic messages — raw DB errors never exposed.
- **`UNAUTHENTICATED` (401) vs `ACCESS_DENIED` (403)** are kept separate and distinct.
- **Audit write failure policy** is deferred — whether audit failures block operations is a future decision.

## Authorization Contract Decisions

- **Authorization flow**: authenticate → resolve user → resolve tenant → check permission → validate input → call service → audit.
- **All permissions are hardcoded** in `ROLE_PERMISSIONS` map — no database-backed permission table in MVP.
- **Sensitive permission denials** may produce audit events with `result: 'DENIED'`.
- **TenantContext** is resolved via `resolveTenantContext(userId, businessId)` which verifies ACTIVE membership.
- **UI permission checks are advisory only** — server always re-evaluates.

---

## Endpoint Groups Designed

| Group | Endpoints | Description |
|---|---|---|
| Identity | 3 | `GET/PATCH /api/identity/me`, `GET /api/identity/users/:userId` |
| Sessions | 3 | `POST/GET /api/identity/sessions`, `POST /api/identity/sessions/:sessionId/revoke` |
| Businesses / Workspaces | 4 | `POST/GET /api/businesses`, `GET/PATCH /api/businesses/:businessId` |
| Memberships | 5 | `GET/POST /api/businesses/:businessId/memberships`, `PATCH role`, `PATCH status`, `DELETE` |
| Authorization | 3 | `POST evaluate`, `POST require`, `GET roles/:role/permissions` |
| Audit | 2 | `GET /api/businesses/:businessId/audit-events`, `GET .../audit-events/:auditEventId` |
| **Total** | **20** | |

---

## Non-Implementation Confirmation

This task confirms:

- ✅ No API routes created
- ✅ No route handlers created
- ✅ No middleware created
- ✅ No auth runtime implemented
- ✅ No UI created
- ✅ No Prisma schema changes
- ✅ No migrations created
- ✅ No new Prisma models added
- ✅ No provider SDKs added (no Clerk, NextAuth, etc.)
- ✅ No Supabase integration
- ✅ No contracts scaffold generated
- ✅ No domain renames
- ✅ No dependencies added
- ✅ No `src/*` files modified
- ✅ No `package.json` modified
- ✅ No `pnpm-lock.yaml` modified
- ✅ No `.env.example` modified
- ✅ No `.github/*` modified
- ✅ No `__tests__/*` modified

---

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Passed |
| `pnpm prisma:format` | ✅ Passed |
| `pnpm prisma:generate` | ✅ Passed (Prisma Client v7.8.0) |
| `pnpm typecheck` | ✅ Passed |
| `pnpm lint` | ✅ Passed |
| `pnpm test` | ✅ Passed — 8 test files passed, 1 skipped (integration), 168 tests passed, 7 skipped |
| `pnpm build` | ✅ Passed — Next.js 15.5.16 production build succeeded |

## Issues Found

None. All checks passed without errors.

---

## Decision

**Accepted** tenant and identity API contract design.

## Recommended Next Task

**[Phase 1] TASK-0013:** Implement tenant and identity API route skeletons.

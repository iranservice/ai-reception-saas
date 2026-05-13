# TASK-0021: Business Workspace API Handler Contracts Behind Feature Gate

## Summary

Implements feature-gated business workspace API handler contracts for `POST /api/businesses`, `GET /api/businesses`, `GET /api/businesses/:businessId`, and `PATCH /api/businesses/:businessId`. Default behavior remains `NOT_IMPLEMENTED`. Enabled behavior returns `AUTH_CONTEXT_UNAVAILABLE` until dev auth is enabled. Business creation uses context userId. Read/update by ID enforce tenant businessId match and authz permission checks.

## Files Created

- `src/app/api/businesses/handler.ts` — Business workspace handler builders (POST, GET, GET_BY_ID, PATCH_BY_ID)
- `__tests__/api/businesses-handler.test.ts` — 37 tests covering handlers, routes, and scope guards
- `docs/checkpoints/TASK-0021-business-workspace-api-handler-contracts.md` — This checkpoint

## Files Modified

- `src/app/api/businesses/route.ts` — Replaced placeholder with feature-gated POST/GET wiring
- `src/app/api/businesses/[businessId]/route.ts` — Replaced placeholder with feature-gated GET/PATCH wiring
- `__tests__/api/api-route-feature-gate.test.ts` — Removed business routes from placeholder list, updated calls
- `__tests__/api/identity-me-handler.test.ts` — Removed business routes from scope guard list
- `__tests__/api/identity-sessions-handler.test.ts` — Removed business routes from scope guard list
- `__tests__/api/tenant-identity-route-skeletons.test.ts` — Updated business route calls to pass Request/context
- `__tests__/api/api-handler-utilities.test.ts` — Updated business route call and scope guard
- `__tests__/api/api-composition-root.test.ts` — Updated business route call

## Handler Design

Four factory functions exported:

- `createPostBusinessesHandler` — POST /api/businesses (authenticated context)
- `createGetBusinessesHandler` — GET /api/businesses (authenticated context)
- `createGetBusinessByIdHandler` — GET /api/businesses/:businessId (tenant context + authz)
- `createPatchBusinessByIdHandler` — PATCH /api/businesses/:businessId (tenant context + authz)
- `createBusinessWorkspaceHandlers` — Combined factory

## Feature Gate Behavior

| Condition | POST | GET | GET :id | PATCH :id |
|---|---|---|---|---|
| ENABLE_API_HANDLERS missing | 501 NOT_IMPLEMENTED | 501 NOT_IMPLEMENTED | 501 NOT_IMPLEMENTED | 501 NOT_IMPLEMENTED |
| ENABLE_API_HANDLERS=true (no dev auth) | 501 AUTH_CONTEXT_UNAVAILABLE | 501 AUTH_CONTEXT_UNAVAILABLE | 501 AUTH_CONTEXT_UNAVAILABLE | 501 AUTH_CONTEXT_UNAVAILABLE |
| Both enabled + dev headers | Service result | Service result | Service result | Service result |

## Context Behavior

- POST/GET use authenticated context (x-dev-user-id)
- GET/PATCH by ID use tenant context (x-dev-user-id + x-dev-business-id + x-dev-membership-id + x-dev-role)
- Context resolution happens before any validation or service call
- Service is never called if context resolution fails

## Business Creation Behavior

1. Resolve authenticated context
2. Validate body against `createBusinessInputSchema.omit({ createdByUserId: true }).strict()`
3. Call `createBusiness({ ...body, createdByUserId: context.userId })`
4. createdByUserId injected from context — body createdByUserId is rejected by strict schema

## Business Listing Behavior

1. Resolve authenticated context
2. Parse `includeInactive` boolean query param
3. Call `listUserBusinesses({ userId: context.userId, includeInactive })`

## Business Read Behavior

1. Resolve tenant context
2. Validate `businessId` route param (UUID)
3. Check route businessId matches tenant context businessId → 403 TENANT_ACCESS_DENIED if mismatch
4. Run authz `requirePermission` for `business.read`
5. If authz denies → 403 ACCESS_DENIED
6. Call `findBusinessById({ businessId })`
7. If null → 404 BUSINESS_NOT_FOUND

## Business Update Behavior

1. Resolve tenant context
2. Validate `businessId` route param (UUID)
3. Check route businessId matches tenant context businessId → 403 TENANT_ACCESS_DENIED if mismatch
4. Run authz `requirePermission` for `business.update`
5. If authz denies → 403 ACCESS_DENIED
6. Validate body against `updateBusinessRequestBodySchema` (at least one field required)
7. Call `updateBusiness({ ...body, businessId: params.businessId })`

## Authorization Behavior

- GET by ID requires `business.read` permission
- PATCH by ID requires `business.update` permission
- Authz checked after tenant context but before service call
- findBusinessById/updateBusiness never called if authz denies

## Route Changes

### POST/GET /api/businesses
Replaced `createPlaceholderRoute` with explicit feature-gated functions. Uses lazy `getApiDependencies()` inside enabled branch.

### GET/PATCH /api/businesses/:businessId
Replaced `createPlaceholderRoute` with feature-gated functions using `Promise<{ businessId: string }>` params for Next.js 15 App Router. Route params resolved only after feature gate check.

## Tests Added

37 new tests total (445 total passing, 7 skipped)

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` | ✅ 445 passed, 7 skipped |
| `pnpm build` | ✅ |

## Issues Found

1. `createTenantRequestContext` takes `{ tenant: TenantContext }` not flat fields
2. Empty `it.each` array causes "No test found in suite" error in vitest
3. Multiple existing tests called business routes without Request objects

## Decision

Accepted business workspace API handler contracts behind feature gate.

## Recommended Next Task

[Phase 1] TASK-0022: Implement business membership API handler contracts behind feature gate

## Scope Confirmation

- ✅ Only business workspace routes changed
- ✅ Default behavior remains NOT_IMPLEMENTED
- ✅ Enabled behavior returns AUTH_CONTEXT_UNAVAILABLE until dev auth is enabled
- ✅ Dev auth mode can call mocked tenancy/authz business services
- ✅ Service calls occur only after successful context resolution
- ✅ Authz is checked before business read/update by id
- ✅ No service calls when feature gate disabled
- ✅ No getApiDependencies call when feature gate disabled
- ✅ No getPrisma usage in route or handler files
- ✅ No PrismaClient usage in route or handler files
- ✅ No middleware
- ✅ No real authentication
- ✅ No token verification
- ✅ No session cookie parsing
- ✅ No auth provider integration
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames

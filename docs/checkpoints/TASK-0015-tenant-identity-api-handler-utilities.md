# TASK-0015: Tenant and Identity API Handler Utilities

## Summary

Implemented shared API handler utility primitives for converting ActionResult to HTTP responses, reading/validating JSON request bodies, validating route params, parsing query parameters, and wrapping handlers with error boundaries. Route skeleton files remain unchanged and do not import these utilities.

---

## Files Created

| File | Purpose |
|---|---|
| `src/app/api/_shared/action-result.ts` | `actionResultToResponse`, `actionResultToResponseWithStatus` |
| `src/app/api/_shared/request.ts` | `readJsonBody`, `validateJsonBody`, `readOptionalJsonBody`, `makeJsonRequest` |
| `src/app/api/_shared/params.ts` | `validateRouteParams`, `parseBooleanQueryParam`, `parseIntegerQueryParam`, `getSearchParam`, `uuidParamSchema` |
| `src/app/api/_shared/handler.ts` | `withApiErrorBoundary`, `notImplementedHandler`, `ApiHandler` type |
| `__tests__/api/api-handler-utilities.test.ts` | 30 tests: helpers + scope guards |
| `docs/checkpoints/TASK-0015-tenant-identity-api-handler-utilities.md` | This checkpoint |

## Files Modified

| File | Change |
|---|---|
| `src/app/api/_shared/errors.ts` | Added `INVALID_JSON_BODY` (400), `INTERNAL_SERVER_ERROR` (500), `NOT_IMPLEMENTED` (501) to status map |

---

## ActionResult Response Utilities

- `actionResultToResponse<T>(result, init?)` — ok → apiOk(200), err → apiError(mapped status)
- `actionResultToResponseWithStatus<T>(result, successStatus)` — ok → apiOk(custom status), err → apiError(mapped status)

## Request Body Utilities

- `readJsonBody(request)` — parses JSON body, returns `INVALID_JSON_BODY` on failure
- `validateJsonBody(request, schema, code, msg)` — reads + validates with Zod
- `readOptionalJsonBody(request, schema, code, msg)` — returns `undefined` for empty body
- `makeJsonRequest(body, init?)` — creates Request with JSON body (utility for tests)

## Route Param and Query Utilities

- `validateRouteParams(params, schema, code, msg)` — validates params with Zod
- `parseBooleanQueryParam(value)` — 'true'/'false'/null → boolean/undefined
- `parseIntegerQueryParam(value)` — integer string → number/undefined
- `getSearchParam(request, key)` — reads URL query param
- `uuidParamSchema(paramName)` — creates `z.object({ [name]: z.string().uuid() })`

## Handler Boundary Utilities

- `withApiErrorBoundary(handler)` — try/catch → `INTERNAL_SERVER_ERROR` (500)
- `notImplementedHandler(endpoint)` — factory returning NOT_IMPLEMENTED handler

## Error Map Updates

Added to `API_ERROR_STATUS_MAP`:

| Code | Status | Source |
|---|---|---|
| `INVALID_JSON_BODY` | 400 | Request body parsing |
| `INTERNAL_SERVER_ERROR` | 500 | Handler error boundary |
| `NOT_IMPLEMENTED` | 501 | Placeholder routes |

---

## Tests Added

| Test Group | Count |
|---|---|
| `actionResultToResponse` | 3 |
| `actionResultToResponseWithStatus` | 2 |
| `readJsonBody` | 2 |
| `validateJsonBody` | 2 |
| `readOptionalJsonBody` | 3 |
| `makeJsonRequest` | 2 |
| `validateRouteParams` | 2 |
| `parseBooleanQueryParam` | 2 |
| `parseIntegerQueryParam` | 2 |
| `getSearchParam` | 1 |
| `uuidParamSchema` | 1 |
| `withApiErrorBoundary` | 3 |
| `notImplementedHandler` | 1 |
| Route skeleton isolation | 2 |
| Route file import scope guard | 2 |
| **Total** | **30** |

---

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Passed |
| `pnpm prisma:format` | ✅ Passed |
| `pnpm prisma:generate` | ✅ Passed |
| `pnpm typecheck` | ✅ Passed |
| `pnpm lint` | ✅ Passed |
| `pnpm test` | ✅ Passed — 11 files passed, 1 skipped (integration), 275 tests passed, 7 skipped |
| `pnpm build` | ✅ Passed — 16 API routes, all unchanged |

## Issues Found

- `parseIntegerQueryParam('')` initially returned `0` because `Number('')` is `0`. Fixed by adding empty-string guard.

---

## Non-Implementation Confirmation

- ✅ Shared handler utilities only
- ✅ Route skeleton behavior unchanged
- ✅ Route files do not import handler utilities yet
- ✅ No service calls
- ✅ No repository calls
- ✅ No getApiDependencies usage in route files
- ✅ No PrismaClient usage
- ✅ No getPrisma usage
- ✅ No middleware
- ✅ No auth runtime
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames

---

## Decision

**Accepted** tenant and identity API handler utilities.

## Recommended Next Task

**[Phase 1] TASK-0016:** Implement tenant and identity route handlers behind placeholder-safe feature gate.

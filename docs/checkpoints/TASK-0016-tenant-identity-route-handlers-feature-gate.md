# TASK-0016: Tenant and Identity Route Handlers Behind Placeholder-Safe Feature Gate

## Summary

Introduced a placeholder-safe API route feature gate controlled by `ENABLE_API_HANDLERS` env var. Updated all 15 route skeleton files (20 HTTP methods) to use `createPlaceholderRoute` wrapper. Default behavior remains `NOT_IMPLEMENTED` regardless of whether the feature gate is enabled or disabled, since all routes use placeholder handlers.

---

## Files Created

| File | Purpose |
|---|---|
| `src/app/api/_shared/feature-gate.ts` | `areApiHandlersEnabled`, `requireApiHandlersEnabled`, `API_HANDLERS_FEATURE_FLAG` |
| `src/app/api/_shared/route-handler.ts` | `createFeatureGatedRoute`, `createPlaceholderRoute`, `RouteHandler`, `FeatureGatedRouteOptions` |
| `__tests__/api/api-route-feature-gate.test.ts` | 48 tests: gate, wrapper, routes, scope guards, inventory |
| `docs/checkpoints/TASK-0016-tenant-identity-route-handlers-feature-gate.md` | This checkpoint |

## Files Modified

| File | Change |
|---|---|
| `src/app/api/identity/me/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/identity/users/[userId]/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/identity/sessions/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/identity/sessions/[sessionId]/revoke/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/[businessId]/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/[businessId]/memberships/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/[businessId]/memberships/[membershipId]/role/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/[businessId]/memberships/[membershipId]/status/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/[businessId]/memberships/[membershipId]/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/[businessId]/audit-events/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/businesses/[businessId]/audit-events/[auditEventId]/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/authz/evaluate/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/authz/require/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |
| `src/app/api/authz/roles/[role]/permissions/route.ts` | Replaced `apiNotImplemented` → `createPlaceholderRoute` |

---

## Feature Gate

- Env var: `ENABLE_API_HANDLERS`
- Only exact `"true"` enables handlers
- `"TRUE"`, `"1"`, `"yes"`, `""`, missing → disabled
- Feature gate is checked at handler invocation time (not module import time)
- Gate supports explicit env injection for test isolation

## Route Handler Wrapper

### `createFeatureGatedRoute(options)`

- When disabled: returns `NOT_IMPLEMENTED`, handler is never called
- When enabled: calls handler wrapped in `withApiErrorBoundary`

### `createPlaceholderRoute(endpoint)`

- Uses `createFeatureGatedRoute` with a placeholder handler
- Returns `NOT_IMPLEMENTED` in both enabled and disabled states
- Used by all 15 route files in this task

## Route Files Updated

All 15 route files now use `createPlaceholderRoute`:

```typescript
import { createPlaceholderRoute } from '@/app/api/_shared/route-handler';
export const GET = createPlaceholderRoute('GET /api/identity/me');
```

## Placeholder Behavior

- **Gate disabled (default):** NOT_IMPLEMENTED via gate short-circuit
- **Gate enabled:** NOT_IMPLEMENTED via placeholder handler through error boundary
- Both paths produce identical 501 responses

---

## Tests Added

| Test Group | Count |
|---|---|
| `areApiHandlersEnabled` — env missing | 1 |
| `areApiHandlersEnabled` — exact "true" | 1 |
| `areApiHandlersEnabled` — "TRUE", "1", "yes", "" | 1 |
| `createFeatureGatedRoute` — NOT_IMPLEMENTED when disabled | 1 |
| `createFeatureGatedRoute` — handler not called when disabled | 1 |
| `createFeatureGatedRoute` — handler called when enabled | 1 |
| `createFeatureGatedRoute` — error boundary on throw | 1 |
| `createPlaceholderRoute` — disabled behavior | 1 |
| `createPlaceholderRoute` — enabled behavior | 1 |
| Route default NOT_IMPLEMENTED (6 routes) | 6 |
| Route enabled NOT_IMPLEMENTED (2 routes) | 2 |
| Route imports `createPlaceholderRoute` (15 files) | 15 |
| Route forbidden imports (15 files) | 15 |
| Route inventory (15 files) | 1 |
| **Total** | **48** |

---

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Passed |
| `pnpm prisma:format` | ✅ Passed |
| `pnpm prisma:generate` | ✅ Passed |
| `pnpm typecheck` | ✅ Passed |
| `pnpm lint` | ✅ Passed |
| `pnpm test` | ✅ Passed — 12 files passed, 1 skipped (integration), 323 tests passed, 7 skipped |
| `pnpm build` | ✅ Passed — 16 API routes, all registered |

## Issues Found

- `NodeJS.ProcessEnv` type required `NODE_ENV` due to Next.js type extensions, causing test compilation errors. Fixed by using `Record<string, string | undefined>` for the env parameter type.

---

## Non-Implementation Confirmation

- ✅ Route handlers remain placeholder-only
- ✅ Default route behavior remains NOT_IMPLEMENTED
- ✅ ENABLE_API_HANDLERS=true still returns NOT_IMPLEMENTED for placeholder routes
- ✅ Route wrappers do not call services yet
- ✅ No getApiDependencies usage in route files
- ✅ No getPrisma usage
- ✅ No PrismaClient usage
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

**Accepted** placeholder-safe route handler feature gate.

## Recommended Next Task

**[Phase 1] TASK-0017:** Implement authenticated request context contract.

# TASK-0034B: Fix Auth.js Route Feature Flag Kill Switch Semantics

## Summary

Fixed Auth.js route handler so `ENABLE_AUTHJS_RUNTIME` acts as a true per-request kill switch. Previously, `getHandlers()` checked cached enabled handlers **before** checking the feature flag, meaning a previously-enabled process could not be disabled without restart. Now GET/POST check the flag **before** accessing any cached handlers.

## Bug

The previous `getHandlers()` function:

```ts
function getHandlers(): AuthjsRouteHandlerOutput | null {
  if (cachedEnabledHandlers) return cachedEnabledHandlers; // ← checked FIRST
  if (!isAuthjsRuntimeEnabled()) return null;              // ← checked SECOND
  ...
}
```

If handlers were cached from a previous enabled request, the flag check was skipped entirely.

## Fix

GET/POST now check the flag inline before calling `getEnabledHandlers()`:

```ts
export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthjsRuntimeEnabled()) {
    return createDisabledAuthjsRouteResponse();
  }
  return getEnabledHandlers().GET(req);
}
```

`getEnabledHandlers()` is only called when the flag is confirmed enabled.

## Files Modified

- `src/app/api/auth/[...nextauth]/route.ts` — kill switch fix
- `__tests__/auth/authjs-route-handlers.test.ts` — 3 kill switch semantics tests

## Files Created

- `docs/checkpoints/TASK-0034B-authjs-route-feature-flag-kill-switch.md` — this file

## Tests Added (3 tests)

- Route handler checks `isAuthjsRuntimeEnabled` before accessing cache
- `getHandlers` function no longer exists (replaced by `getEnabledHandlers`)
- Route exports GET and POST that return disabled response when flag is off

## Checks Run

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 4 warnings) |
| `pnpm test` | ✅ 708 passed, 7 skipped |
| `pnpm build` | ✅ |

## Scope

- ✅ Kill switch semantics fixed
- ✅ Flag checked before cache on every request
- ✅ No middleware
- ✅ No provider changes
- ✅ No schema/migration changes
- ✅ No package changes
- ✅ No env changes

## Decision

Accepted kill switch fix; feature flag is now a true per-request gate that cannot be bypassed by cached handlers.

## Recommended Next Task

[Phase 2] TASK-0035: Auth.js provider configuration design and environment contract

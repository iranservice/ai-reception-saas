# TASK-0014: API Composition Root and Dependency Wiring

## Summary

Implemented a server-side API composition root that wires Prisma → repositories → services for the tenant/identity/authz/audit domains. The composition root provides a lazy singleton accessor and test reset utility. Route skeleton files remain unchanged and continue returning `NOT_IMPLEMENTED` placeholders.

---

## Files Created

| File | Purpose |
|---|---|
| `src/app/api/_shared/composition.types.ts` | `ApiRepositories`, `ApiServices`, `ApiDependencies`, `PrismaCompatibleClient`, `ApiCompositionOptions` |
| `src/app/api/_shared/composition.ts` | `createApiDependencies`, `getApiDependencies`, `resetApiDependenciesForTests`, DB adapters |
| `__tests__/api/api-composition-root.test.ts` | 10 tests: wiring, singleton, reset, route isolation |
| `docs/checkpoints/TASK-0014-api-composition-root-dependency-wiring.md` | This checkpoint |

## Files Modified

None. No existing files were modified.

---

## Composition Root

### `createApiDependencies(options?)`

Wires the full dependency graph:

1. Obtains Prisma client from `getPrisma()` or `options.prisma`
2. Creates repository DB adapters (narrow slices of Prisma delegates)
3. Creates repositories from adapters
4. Creates services from repositories (authz is stateless)
5. Returns `{ repositories, services }`

### `getApiDependencies()`

Lazy singleton — creates on first call, returns same instance thereafter.

### `resetApiDependenciesForTests()`

Clears the singleton for test isolation.

## Dependency Graph

```
getPrisma() / options.prisma
├─► toIdentityRepositoryDb() ──► createIdentityRepository() ──► createIdentityService()
├─► toTenancyRepositoryDb()  ──► createTenancyRepository()  ──► createTenancyService()
├─► toAuditRepositoryDb()    ──► createAuditRepository()     ──► createAuditService()
└─► (none)                                                   ──► createAuthzService()
```

## Repository Wiring

| Repository | DB Adapter | Delegates Used |
|---|---|---|
| `IdentityRepository` | `toIdentityRepositoryDb()` | `user`, `session` |
| `TenancyRepository` | `toTenancyRepositoryDb()` | `business`, `businessMembership` |
| `AuditRepository` | `toAuditRepositoryDb()` | `auditEvent` |

## Service Wiring

| Service | Dependencies |
|---|---|
| `IdentityService` | `{ repository: identityRepository }` |
| `TenancyService` | `{ repository: tenancyRepository }` |
| `AuthzService` | None — stateless, uses pure permission helpers |
| `AuditService` | `{ repository: auditRepository }` |

## Singleton Behavior

- First call to `getApiDependencies()` creates the container
- Subsequent calls return the same instance (reference equality)
- `resetApiDependenciesForTests()` clears the instance
- Next call after reset creates a new container

---

## Tests Added

| Test | Description |
|---|---|
| Wires all repositories and services | Creates with mock prisma, asserts all 7 properties exist |
| Returns repositories with expected methods | Verifies repository interface methods are present |
| Returns services with expected methods | Verifies service interface methods are present |
| Singleton returns same instance | Calls twice, asserts reference equality |
| Reset clears singleton | Creates, resets, creates again, asserts different references |
| GET /api/identity/me still returns 501 | Route skeleton isolation check |
| POST /api/businesses still returns 501 | Route skeleton isolation check |
| POST /api/authz/evaluate still returns 501 | Route skeleton isolation check |
| Can create dependencies without route imports | Composition root independence |
| Route files do not import composition root | Routes work without composition initialization |

**Total: 10 new tests** (245 total passed, 7 integration skipped)

---

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Passed |
| `pnpm prisma:format` | ✅ Passed |
| `pnpm prisma:generate` | ✅ Passed |
| `pnpm typecheck` | ✅ Passed |
| `pnpm lint` | ✅ Passed |
| `pnpm test` | ✅ Passed — 10 files passed, 1 skipped (integration), 245 tests passed, 7 skipped |
| `pnpm build` | ✅ Passed — 16 API routes, all unchanged |

## Issues Found

None. All checks passed without errors.

---

## Non-Implementation Confirmation

- ✅ Composition root only
- ✅ Route skeleton behavior unchanged
- ✅ Route files do not import composition root
- ✅ No real API behavior implemented
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
- ✅ No dependencies added
- ✅ No existing files modified

---

## Decision

**Accepted** API composition root and dependency wiring.

## Recommended Next Task

**[Phase 1] TASK-0015:** Implement tenant and identity API handler utilities.

# Auth.js Request-Context Resolver Design

## Status

Accepted design proposal for future implementation.

## Context

### Current Request-Context Abstraction

The API layer uses a typed request-context contract (`src/app/api/_shared/request-context.ts`) with four context levels:

| Context Type | Interface | Description |
|---|---|---|
| Anonymous | `AnonymousRequestContext` | Unauthenticated request |
| Authenticated | `AuthenticatedUserRequestContext` | Authenticated user, no tenant scope |
| Tenant | `TenantRequestContext` | Authenticated user within a tenant |
| System | `SystemRequestContext` | Internal/system operations |

Context resolution flows through `AuthContextAdapter`, an interface with three resolver methods:

```ts
interface AuthContextAdapter {
  resolveAuthenticated(request: Request): Promise<ContextResult<AuthenticatedUserRequestContext>>;
  resolveTenant(request: Request): Promise<ContextResult<TenantRequestContext>>;
  resolveSystem(request: Request): Promise<ContextResult<SystemRequestContext>>;
}
```

### Current Dev Header Adapter

The default adapter (`createDevHeaderAuthContextAdapter`) uses dev headers for context resolution:

- Gated behind `ENABLE_DEV_AUTH_CONTEXT === "true"`
- When disabled, all resolvers return `AUTH_CONTEXT_UNAVAILABLE` (501)
- When enabled, reads headers: `x-dev-user-id`, `x-dev-business-id`, `x-dev-membership-id`, `x-dev-role`, `x-dev-system`
- Not suitable for production — intended for local/test development only

### Auth.js Provider Sessions Now Exist

As of TASK-0036, Auth.js provider-backed sessions exist behind feature flags:

- `ENABLE_AUTHJS_RUNTIME === "true"` enables the Auth.js route at `/api/auth/[...nextauth]`
- `ENABLE_AUTHJS_GOOGLE_PROVIDER === "true"` enables Google OAuth
- Auth.js adapter maps provider users to internal `User` model
- JWT session strategy is enforced (no database sessions)
- Auth.js `NextAuthResult` includes an `auth()` function for session retrieval

### What Remains Deferred

- Production request-context resolver using Auth.js sessions
- Middleware for session validation
- UI for sign-in/sign-out
- Tenant picker
- Session callback JWT enrichment
- Authz policy changes

**This document defines the future implementation boundaries for the production resolver.**

---

## Goals

1. **Authenticated user context from Auth.js session** — resolve `AuthenticatedUserRequestContext` using the Auth.js `auth()` function to retrieve the current JWT session.
2. **Tenant context from session + membership lookup** — resolve `TenantRequestContext` by combining the authenticated user ID from the session with a tenant membership lookup.
3. **System context remains separate** — system context resolution does not use Auth.js sessions. It will continue using a separate mechanism (API key, internal header, or similar).
4. **Safe migration from dev headers** — the production resolver must coexist with the dev header adapter during the transition period. The active adapter must be selectable via feature flag.
5. **Feature flag strategy** — a new feature flag controls which adapter is active for request-context resolution.
6. **Error behavior** — clearly defined error responses for unauthenticated, expired, or invalid sessions.
7. **Test strategy** — unit-testable without real Auth.js sessions or database.
8. **Rollout plan** — gradual rollout from dev headers → Auth.js resolver.

---

## Non-Goals

This design document explicitly excludes:

- No implementation in this task
- No middleware
- No UI (sign-in/sign-out pages or components)
- No tenant picker
- No session callback mutation
- No JWT token enrichment implementation (e.g. embedding tenant IDs in JWT)
- No authz policy changes
- No Prisma schema changes
- No migrations
- No production rollout

---

## Proposed Resolver Architecture

### New Adapter Factory

A future implementation task will create:

```ts
interface TenantMembershipResolver {
  findMembershipForUserBusiness(input: {
    userId: string;
    businessId: string;
  }): Promise<Result<TenantContext | null, DomainError>>;
}

function createAuthjsRequestContextAdapter(options: {
  auth: (request: Request) => Promise<AuthjsSession | null>;
  tenantMembershipResolver: TenantMembershipResolver;
  env?: Record<string, string | undefined>;
}): AuthContextAdapter
```

Where:
- `auth` receives the incoming `Request` and returns the JWT session — the resolver must be request-aware because Auth.js reads session cookies from the request headers
- `tenantMembershipResolver` is a neutral interface for membership lookups — not coupled to a specific repository implementation
- `env` allows test-time environment override

### Adapter Behavior

#### `resolveAuthenticated(request)`

1. Call `auth(request)` to retrieve the current session from the request's cookies.
2. If no session or no `session.user` → return `UNAUTHENTICATED` (401).
3. If session exists and `session.user.id` is present → return `AuthenticatedUserRequestContext` with the user ID.
4. If `session.user.id` is missing → return `INVALID_AUTH_CONTEXT` (400) — indicates a misconfigured JWT callback.

```
Request → auth(request) → session.user.id → AuthenticatedUserRequestContext
                        → null             → UNAUTHENTICATED (401)
```

#### `resolveTenant(request)`

1. Call `resolveAuthenticated(request)` first to get the user ID.
2. If unauthenticated → propagate the failure.
3. Resolve the tenant identifier (business ID) from the request using the following **strict source order**:

   | Priority | Source | When Used | Example |
   |---|---|---|---|
   | 1 | Route parameter `businessId` | Business-scoped routes | `/api/businesses/:businessId/...` |
   | 2 | `x-business-id` header | Generic routes needing tenant scope | Any route |
   | — | Query / body | **Not accepted** | — |
   | — | Session / JWT | **Must not silently choose** | — |
   | — | Last-used tenant | **Deferred** | — |

   **Why this order:**
   - Prevents confused-deputy attacks: URL path is the explicit resource scope; a header cannot override it
   - Avoids mismatch between URL `businessId` and header `businessId`
   - Keeps tenant authorization explicit — the client states which tenant it intends
   - Avoids stale JWT tenant claims that could reference revoked memberships
   - Fits the current route structure where business-scoped routes already include `businessId` in the path

4. If route param and header both present and differ → return `INVALID_AUTH_CONTEXT` (400) with mismatch message.
5. If no tenant identifier found from any accepted source → return `TENANT_CONTEXT_REQUIRED` (403).
6. Call `tenantMembershipResolver.findMembershipForUserBusiness({ userId, businessId })`.
7. If no membership found → return `ACCESS_DENIED` (403).
8. If membership found → return `TenantRequestContext` with `userId`, `businessId`, `membershipId`, and `role`.

```
Request → auth(request) → userId
        → route param OR x-business-id header → businessId
        → tenantMembershipResolver.findMembershipForUserBusiness(userId, businessId)
        → found    → TenantRequestContext
        → not found → ACCESS_DENIED (403)
```

#### `resolveSystem(request)`

System context resolution does **not** use Auth.js sessions. It remains a separate mechanism:

- In the current dev header adapter: reads `x-dev-system` header.
- In production: will use API key validation, internal service token, or similar.
- This resolver is **not** part of the Auth.js adapter — it is handled separately.

### Feature Flag: Adapter Selection

A new feature flag controls which adapter is active:

```
ENABLE_AUTHJS_REQUEST_CONTEXT=true
```

- **When not `"true"` (default):** `getDefaultAuthContextAdapter()` returns the dev header adapter (current behavior).
- **When `"true"`:** `getDefaultAuthContextAdapter()` returns the Auth.js adapter.
- **Exact `"true"` semantics** — same strictness as all other feature flags.

The adapter selection happens in `getDefaultAuthContextAdapter()`:

```ts
export function getDefaultAuthContextAdapter(): AuthContextAdapter {
  if (isAuthjsRequestContextEnabled()) {
    return createAuthjsRequestContextAdapter({
      auth: getAuthjsAuth(),
      tenantMembershipResolver: getTenantMembershipResolver(),
    });
  }
  return createDevHeaderAuthContextAdapter();
}
```

Where `getTenantMembershipResolver()` returns an implementation of `TenantMembershipResolver` backed by the current tenancy infrastructure. The concrete wiring is an implementation detail deferred to the implementation task.

### Auth.js `auth()` Access

The `auth()` function is returned by `NextAuth()` alongside the route handlers. It must be exposed from the route initialization path:

```ts
// In route.ts or a shared auth module:
const nextAuth: NextAuthResult = NextAuth({ ... });
export const auth = nextAuth.auth;
```

**Key constraint:** `auth()` is only available when `ENABLE_AUTHJS_RUNTIME === "true"`. If `ENABLE_AUTHJS_REQUEST_CONTEXT === "true"` but `ENABLE_AUTHJS_RUNTIME !== "true"`, the adapter must fail with a clear configuration error — not silently return unauthenticated.

### Flag Dependency Matrix

| `ENABLE_AUTHJS_RUNTIME` | `ENABLE_AUTHJS_REQUEST_CONTEXT` | Result |
|---|---|---|
| `"true"` | `"true"` | Auth.js session resolver active |
| `"true"` | not `"true"` | Dev header adapter (current) |
| not `"true"` | `"true"` | Configuration error — `auth()` unavailable |
| not `"true"` | not `"true"` | Dev header adapter (current) |

---

## Session Shape Assumptions

Auth.js JWT sessions (v5 beta) expose a `Session` type:

```ts
interface Session {
  user: {
    id?: string;       // Requires jwt callback to include
    name?: string;
    email?: string;
    image?: string;
  };
  expires: string;     // ISO date string
}
```

**Important:** By default, Auth.js does not include `user.id` in the JWT token or session. A `jwt` callback must be configured to copy `token.sub` → `session.user.id`.

This means a prerequisite implementation task must:

1. Add a `jwt` callback to copy `token.sub` to the token.
2. Add a `session` callback to copy `token.sub` to `session.user.id`.

Without this, `resolveAuthenticated` will always fail with `INVALID_AUTH_CONTEXT` because `session.user.id` will be undefined.

---

## Error Behavior

| Scenario | Error Code | HTTP Status | Description |
|---|---|---|---|
| No session | `UNAUTHENTICATED` | 401 | No valid JWT cookie/token |
| Session without user ID | `INVALID_AUTH_CONTEXT` | 400 | JWT callback misconfigured |
| No tenant identifier | `TENANT_CONTEXT_REQUIRED` | 403 | No route param or header |
| Route param / header mismatch | `INVALID_AUTH_CONTEXT` | 400 | Conflicting tenant identifiers |
| No membership | `ACCESS_DENIED` | 403 | User has no membership in tenant |
| Runtime disabled + context enabled | Configuration error | 500 | `auth()` not available |

---

## Test Strategy

### Unit Tests (no DB, no Auth.js)

1. **Mock `auth(request)`** to return various session shapes (valid, null, missing user ID).
2. **Mock `tenantMembershipResolver`** to return or reject membership lookups.
3. Test all error paths and success paths including tenant source priority and mismatch detection.
4. Test feature flag gating.

### Integration Tests (with DB, no real OAuth)

1. Create users and memberships in test database.
2. Mock `auth()` to return a session with a known user ID.
3. Verify tenant resolution against real membership data.

### No Real OAuth Required

- All tests mock `auth()` at the adapter boundary.
- No real Google OAuth flow needed for request-context testing.
- Real OAuth is only needed for the smoke-test runbook (TASK-0037).

---

## Rollout Plan

### Phase 1: JWT Callback Setup (Prerequisite)

- Add `jwt` and `session` callbacks to Auth.js config
- Ensure `session.user.id` is populated from `token.sub`
- Behind existing `ENABLE_AUTHJS_RUNTIME` flag
- No request-context changes

### Phase 2: Auth.js Request-Context Adapter Implementation

- Create `createAuthjsRequestContextAdapter`
- Add `ENABLE_AUTHJS_REQUEST_CONTEXT` feature flag
- Wire into `getDefaultAuthContextAdapter()`
- All existing dev header behavior preserved when flag is disabled
- Comprehensive unit tests

### Phase 3: Tenant Resolution

- Implement `TenantMembershipResolver` backed by tenancy infrastructure
- Implement tenant source priority: route param → `x-business-id` header
- Implement route param / header mismatch detection
- Membership lookup and role extraction
- Test tenant context resolution

### Phase 4: System Context (Separate Track)

- System context uses API key or service token
- Not coupled to Auth.js sessions
- Can be implemented independently

### Phase 5: Migration

- Enable `ENABLE_AUTHJS_REQUEST_CONTEXT=true` in staging
- Verify all API routes work with Auth.js sessions
- Disable `ENABLE_DEV_AUTH_CONTEXT` in staging
- Promote to production
- Remove dev header adapter code when no longer needed

---

## Dependencies

| Dependency | Status | Required Before |
|---|---|---|
| Auth.js route handler | ✅ Done (TASK-0034) | Phase 2 |
| Auth.js kill switch | ✅ Done (TASK-0034B) | Phase 2 |
| Google provider config | ✅ Done (TASK-0036) | Phase 2 |
| JWT callback setup | ❌ Not done | Phase 2 |
| Tenancy repository | ✅ Done | Phase 3 |
| Composition root | ✅ Done | Phase 3 |
| API key / service token | ❌ Not done | Phase 4 |

---

## File Impact Assessment

| File | Change Type | Phase |
|---|---|---|
| `src/app/api/_shared/auth-context-adapter.ts` | Modify `getDefaultAuthContextAdapter` | Phase 2 |
| `src/app/api/_shared/authjs-context-adapter.ts` | New file | Phase 2 |
| `src/lib/auth/authjs-route-handlers.ts` | Export `auth()` from NextAuth result | Phase 1 |
| `src/app/api/auth/[...nextauth]/route.ts` | Expose `auth` export | Phase 1 |
| `__tests__/api/authjs-context-adapter.test.ts` | New test file | Phase 2 |
| `src/lib/auth/authjs-feature-gate.ts` | Add `ENABLE_AUTHJS_REQUEST_CONTEXT` flag | Phase 2 |

---

## Security Constraints

- **JWT-only sessions:** No database session table is used. Session validity depends on JWT expiration and signing.
- **No client-side session modification:** JWT tokens are signed with `AUTH_SECRET`. Tampering is detectable.
- **Tenant isolation:** Membership lookup is server-side. Client cannot fabricate tenant context.
- **No role escalation:** Role is read from `BusinessMembership`, not from client input.
- **Feature flag safety:** If `ENABLE_AUTHJS_REQUEST_CONTEXT` is disabled, all resolvers fall back to the dev header adapter — no partial Auth.js state.
- **No secrets in JWT payload:** Only `sub` (user ID), `name`, `email`, and `image` are included. No tenant IDs, roles, or permissions in the JWT token (looked up server-side per-request).

---

## Open Design Questions

### 1. Tenant Identifier Source Order

**Resolved:** Route param `businessId` takes priority over `x-business-id` header. Both present with different values is an error. Query/body tenant scope is not accepted. Session/JWT must not silently choose a tenant. Last-used tenant is deferred.

### 2. JWT Enrichment Scope

**Question:** Should tenant membership be cached in the JWT token to avoid per-request DB lookups?

**Current recommendation:** No. Look up membership per-request for security. JWT tokens are long-lived; membership changes (revocation, role change) must take effect immediately.

**Decision:** Deferred. May revisit for performance if per-request lookups become a bottleneck.

### 3. System Context Production Mechanism

**Question:** What mechanism replaces `x-dev-system` headers in production?

**Options:** API key validation, internal service mesh token, or mutual TLS.

**Decision:** Deferred to Phase 4. Not coupled to Auth.js.

---

## References

| Resource | Path/URL |
|---|---|
| Request context contract | `src/app/api/_shared/request-context.ts` |
| Auth context adapter | `src/app/api/_shared/auth-context-adapter.ts` |
| Composition root | `src/app/api/_shared/composition.ts` |
| Auth.js route handlers | `src/lib/auth/authjs-route-handlers.ts` |
| Auth.js adapter | `src/lib/auth/authjs-adapter.ts` |
| Auth.js user mapping | `src/lib/auth/authjs-user-mapping.ts` |
| Provider environment contract | `docs/architecture/authjs-provider-environment-contract.md` |
| Auth.js v5 docs | [https://authjs.dev/getting-started](https://authjs.dev/getting-started) |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-15 | Initial design — TASK-0038 |
| 1.1 | 2026-05-15 | CTO review: fix tenant scope order, neutral resolver interface, request-aware auth |

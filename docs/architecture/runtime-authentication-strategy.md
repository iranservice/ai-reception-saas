# Runtime Authentication Strategy and Provider Decision

## Status

Accepted for planning; not implemented.

## Date

2026-05-13

## Baseline

- **Main commit:** `b5dff4ef13f2efcc7b8844de541f941bfedaa0ef`
- **Prior checkpoint:** TASK-0025 API handler baseline acceptance checkpoint
- Current API handler baseline is feature-gated behind `ENABLE_API_HANDLERS`.
- Current dev auth adapter (`ENABLE_DEV_AUTH_CONTEXT`) is not production authentication.

## Context

The project now has feature-gated API handler contracts for:

- Identity self-profile (GET/PATCH `/api/identity/me`)
- Identity sessions (POST/GET sessions, revoke)
- Business workspaces (POST/GET/PATCH)
- Business memberships (list/create/update-role/update-status/delete)
- Tenant audit (list/detail)
- Authz (evaluate/require/role permissions)

Current request context can be resolved through a dev/test header adapter that trusts `x-dev-*` headers when `ENABLE_DEV_AUTH_CONTEXT="true"`. This adapter is intentionally not production authentication — it exists solely for development and testing contract verification.

Phase 2 needs a runtime authentication strategy before implementing real auth. The runtime auth strategy must:

- Preserve internal tenant and authz ownership.
- Not force handlers to depend on provider SDKs.
- Integrate through the existing request-context adapter boundary.
- Support the feature-gated rollout model.

## Decision

The project will use a **provider-abstracted runtime authentication layer**.

The preferred first implementation candidate is **Auth.js**.

The application will keep ownership of:

- `Business` — tenant root entity
- `BusinessMembership` — tenant membership and role assignment
- `MembershipRole` — role enum (OWNER/ADMIN/OPERATOR/VIEWER)
- `AuthzPermission` — permission constants and role-permission mapping
- `TenantContext` — tenant-scoped request context resolution
- `AuditEvent` — audit trail for tenant-scoped operations

Auth provider responsibility will be limited to:

- Authenticating the user (credentials, OAuth, magic link, etc.)
- Producing a verified user identity
- Managing external identity provider account/session mechanics if adopted
- Passing verified user identity into the internal request context resolver

The auth provider must **not** own:

- Tenant authorization
- Business membership roles
- Business-level permissions
- Internal audit policy
- Domain service authorization rules

## Provider Evaluation

| Option | Strengths | Concerns | Decision |
|---|---|---|---|
| Auth.js | Next.js fit, Prisma path, provider-neutral, self-hostable | Requires careful schema/session integration | Preferred first implementation candidate |
| Clerk | Mature managed auth, strong user/org UX | Organization model may duplicate internal Business/Membership model; vendor coupling | Not selected now |
| Supabase Auth | SSR support, integrated backend platform | No Supabase scaffold; platform coupling | Not selected now |
| Better Auth | TypeScript-first, modern API | Needs further maturity/ecosystem review | Track as alternative |
| Fully custom auth | Maximum control | High security maintenance burden | Not selected by default |

### Why Auth.js Is Preferred

- The project already uses Next.js App Router, Prisma, PostgreSQL-style schema design, and internal service boundaries.
- Auth.js has an established Next.js integration path.
- Auth.js has Prisma adapter documentation and can support database-backed sessions/accounts if adopted later.
- Auth.js is more provider-neutral and self-hostable than Clerk.
- Auth.js allows the project to keep Business, BusinessMembership, MembershipRole, and authz permission logic inside the application instead of outsourcing tenancy to a provider organization model.
- Auth.js can be integrated behind the already-created request-context adapter instead of forcing route handlers to depend directly on provider SDKs.

### Why Clerk Is Not Selected Now

- Clerk has strong built-in user management and organization features.
- However, the project already owns Business, BusinessMembership, MembershipRole, and AuthzPermission models/contracts.
- Adopting Clerk Organizations as the source of truth would duplicate or conflict with the internal tenant model.
- Clerk may still be reconsidered later if managed identity UX becomes more important than internal tenancy ownership.

### Why Supabase Auth Is Not Selected Now

- Supabase Auth has Next.js SSR support and cookie-based integration utilities.
- However, the repository currently does not use Supabase scaffold.
- Introducing Supabase Auth would likely couple auth runtime to Supabase project configuration and environment.
- Supabase can remain a future option if the infrastructure decision moves toward Supabase-managed backend services.

### Better Auth / Custom Auth Position

- Better Auth can be tracked as an alternative, especially because of TypeScript-first design.
- Do not select Better Auth as primary until project maturity, ecosystem stability, and adapter needs are reviewed.
- Do not implement fully custom auth as the default strategy unless provider options fail; custom auth increases security maintenance burden.
- Existing `Session` model is not sufficient by itself to declare production auth complete.

## Runtime Architecture

Planned runtime request flow:

```
Request
  → Next.js route
    → feature gate
      → auth provider / session resolver
        → internal request context
          → handler
            → domain service
```

### Rules

- `route.ts` keeps feature gate and lazy composition access.
- The request-context adapter becomes the integration boundary.
- Auth provider integration must stay behind adapter functions.
- Handlers must not import provider SDKs.
- Handlers must not parse provider cookies directly.
- Route files must not contain provider-specific logic except dedicated auth callback routes if introduced later.
- Domain services must remain provider-agnostic.

## Request Context Strategy

### Current State

- `resolveAuthenticatedRequestContext` uses dev/test auth context adapter.
- `resolveTenantRequestContext` uses dev/test auth context adapter.
- `resolveSystemRequestContext` uses dev/test auth context adapter.

### Future Replacement Path

1. Add runtime auth resolver that validates real session/user identity.
2. Resolve authenticated user from provider session.
3. Map provider user identity to internal `User`.
4. Resolve tenant membership from internal `BusinessMembership`.
5. Produce `TenantRequestContext` from internal data.
6. Keep dev adapter only for local/test usage if explicitly enabled.

## Session Strategy

- Do not expose raw session tokens to API handlers.
- Do not trust `userId` from request body.
- API handlers continue to trust only request context.
- If Auth.js is adopted, session/account persistence must be mapped carefully against existing `User` and `Session` models.
- Existing `Session` model may need a future compatibility review before implementation.
- No schema changes are made in this task.

## Tenant Strategy

- `Business` remains the tenant root.
- `BusinessMembership` remains the source of tenant membership and role.
- Provider organizations must not replace `Business` or `BusinessMembership` without explicit migration decision.
- Auth provider user identity must map into internal `User` first.
- Tenant context must be resolved from internal membership state.

## Authorization Strategy

- Auth provider answers **"who is the user?"**
- Internal `AuthzService` answers **"what can this user do in this business?"**
- `MembershipRole` and `AuthzPermission` remain internal.
- Route handlers continue to call domain services through injected dependencies.
- Permission checks remain inside handler/service layer according to accepted baseline.

## Audit Strategy

- Auth events and auth failures should eventually produce `AuditEvent` records where appropriate.
- Provider-specific event payloads must be normalized before audit persistence.
- `AuditEvent` schema is not changed in this task.

## Security Requirements for Future Implementation

- Secure cookies or provider-supported server session mechanism
- CSRF protection where applicable
- Session rotation / expiration strategy
- Verified email policy
- Account linking policy
- Tenant membership lookup after authentication
- No trust in client-supplied userId/businessId/role
- Strict environment variable validation
- Secure local development mode separation
- Production must **not** enable `ENABLE_DEV_AUTH_CONTEXT`
- Test-only headers must not be accepted in production
- Rate limiting and abuse protection to be addressed separately

## Environment Strategy

No environment variables are added or changed in this task.

Possible future variables (conceptual only):

- `AUTH_SECRET` — signing key for auth provider sessions
- `AUTH_URL` or `NEXTAUTH_URL` — public auth callback URL
- Provider client IDs/secrets — OAuth provider credentials
- Feature flags for runtime auth rollout — gradual migration control

## Migration / Schema Impact

- No Prisma schema changes in this task.
- Future Auth.js adoption may require compatibility review with `Account`, `Session`, `VerificationToken`-like concepts.
- Existing internal `User` and `Session` models must be evaluated before accepting provider adapter schema.
- Any future schema changes require separate task and migration.

## Rollout Plan

| Phase | Description |
|---|---|
| 1 | ADR acceptance only — **this task** |
| 2 | Auth provider spike / compatibility review |
| 3 | Auth schema compatibility design |
| 4 | Runtime auth adapter implementation behind feature flag |
| 5 | Route context resolver integration |
| 6 | Session tests and security tests |
| 7 | Production hardening checklist |
| 8 | Remove or restrict dev auth context in production |

## Explicit Non-Goals

- No auth implementation
- No provider SDK installation
- No middleware
- No login/signup UI
- No callback routes
- No Prisma schema changes
- No migrations
- No package changes
- No env changes
- No route changes
- No handler changes
- No tests changed
- No Supabase scaffold
- No Clerk integration
- No Auth.js integration in this task
- No Better Auth integration in this task

## Consequences

### Positive

- Keeps current clean handler architecture.
- Preserves internal tenant and authz model.
- Allows provider choice to be implemented behind adapter boundary.
- Avoids premature vendor lock-in.
- Documents production auth gap clearly.

### Negative

- Production auth remains unimplemented.
- Another task is required for provider compatibility design.
- Auth.js schema/session integration may require careful future migration work.
- Managed organization UX is deferred.

## Acceptance Criteria for Future Runtime Auth

- Verified authenticated user context without dev headers
- Tenant context from internal `BusinessMembership`
- No provider SDK imports in domain services
- No provider SDK imports in handler modules
- Production rejects dev auth headers
- Test suite covers disabled dev auth in production-like env
- Audit logging for auth-sensitive events
- Secure session expiry behavior
- Documented rollback plan

## Decision

Accepted runtime authentication strategy: provider-abstracted adapter with Auth.js as preferred first implementation candidate.

## Recommended Next Task

[Phase 2] TASK-0027: Auth.js compatibility review and auth schema integration design

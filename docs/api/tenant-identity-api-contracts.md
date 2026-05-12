# Tenant and Identity API Contracts

## Purpose

Define planned HTTP API contracts for tenant, identity, membership, session, authorization, and audit flows before route implementation begins.

This document is **design only**. It does not create API routes, handlers, middleware, auth runtime, or UI.

---

## API Principles

- Server resolves tenant context — the client does not dictate authorization state.
- Client-provided `businessId` is **never** sufficient for authorization on its own.
- Every tenant-scoped endpoint requires active membership verification.
- Permission checks happen server-side; UI permission checks are advisory only.
- Request validation uses domain Zod validation schemas (`*InputSchema`).
- Responses use a consistent success/error envelope (see below).
- Audit-relevant operations must be traceable via the audit domain.
- No provider-specific auth assumptions appear in these API contracts.

---

## Response Envelope

### Success Response

```json
{
  "ok": true,
  "data": {}
}
```

### Error Response

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

The `ActionResult<T>` type defined in `src/lib/result.ts` already mirrors this envelope. API route handlers will serialize `ActionResult` directly when possible.

---

## Authentication Assumption

- The exact auth provider is **not selected yet**. These contracts are provider-agnostic.
- Authenticated routes assume a resolved user identity is available in the request context (e.g., via middleware that populates `currentUser: UserIdentity`).
- Public unauthenticated routes are **out of scope** for this task.
- Session endpoints are **contract-only** — they do not define runtime auth implementation (login flows, cookie handling, token refresh, etc.).

---

## Tenant Context Assumption

- Tenant context is resolved from the authenticated user + selected workspace.
- Route params may include `businessId`, but authorization **must** verify active membership via `resolveTenantContext`.
- `businessId` from the client is **not trusted alone** — it must be cross-referenced with the user's membership records.
- The resolved `TenantContext` contains: `businessId`, `userId`, `membershipId`, `role`.

---

## Endpoint Groups

1. [Identity](#identity-endpoints)
2. [Sessions](#session-endpoints)
3. [Businesses / Workspaces](#business--workspace-endpoints)
4. [Memberships](#membership-endpoints)
5. [Authorization](#authorization-endpoints)
6. [Audit](#audit-endpoints)

---

## Identity Endpoints

### GET /api/identity/me

| Field | Value |
|---|---|
| **Purpose** | Return current authenticated user profile |
| **Auth** | Required |
| **Permission** | Authenticated user (no tenant context needed) |
| **Response** | `UserIdentity` |

**Response body (success):**

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "locale": "en",
    "status": "ACTIVE",
    "avatarUrl": "https://..." | null,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
}
```

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `UNAUTHENTICATED` | 401 |
| `USER_NOT_FOUND` | 404 |

---

### PATCH /api/identity/me

| Field | Value |
|---|---|
| **Purpose** | Update current authenticated user profile |
| **Auth** | Required |
| **Permission** | Authenticated user (no tenant context needed) |
| **Request Body** | `UpdateUserInput` |
| **Validation** | `updateUserInputSchema` |
| **Response** | `UserIdentity` |

**Request body:**

```json
{
  "name": "New Name",
  "locale": "fa",
  "avatarUrl": "https://..." | null
}
```

At least one field must be provided. The `status` field is **not** accepted from this endpoint — status changes require admin-level operations (deferred).

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_IDENTITY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `USER_NOT_FOUND` | 404 |

---

### GET /api/identity/users/:userId

| Field | Value |
|---|---|
| **Purpose** | Admin/internal lookup of user by ID |
| **Auth** | Required |
| **Permission** | `members.read` or internal admin policy |
| **Response** | `UserIdentity \| null` |

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `userId` | `string` | UUID format |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_IDENTITY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `USER_NOT_FOUND` | 404 |

---

## Session Endpoints

### POST /api/identity/sessions

| Field | Value |
|---|---|
| **Purpose** | Create an application session after upstream auth validation |
| **Auth** | Internal/system or authenticated flow |
| **Request Body** | `CreateSessionInput` |
| **Validation** | `createSessionInputSchema` |
| **Response** | `SessionIdentity` |

**Request body:**

```json
{
  "userId": "uuid",
  "tokenHash": "sha256-hash-string (min 32 chars)",
  "expiresAt": "ISO-8601 datetime",
  "ipAddress": "optional string",
  "userAgent": "optional string"
}
```

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_IDENTITY_INPUT` | 400 |
| `USER_NOT_FOUND` | 404 |

> **Note:** Whether this endpoint is public or internal-only is an open question pending auth provider selection. The contract documents the shape regardless.

---

### GET /api/identity/sessions

| Field | Value |
|---|---|
| **Purpose** | List current user's sessions |
| **Auth** | Required |
| **Permission** | Authenticated user (own sessions only) |
| **Response** | `readonly SessionIdentity[]` |

**Query params:**

| Param | Type | Default |
|---|---|---|
| `includeRevoked` | `boolean` | `false` |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `UNAUTHENTICATED` | 401 |
| `INVALID_IDENTITY_INPUT` | 400 |

---

### POST /api/identity/sessions/:sessionId/revoke

| Field | Value |
|---|---|
| **Purpose** | Revoke a session |
| **Auth** | Required |
| **Permission** | Authenticated user (own sessions, or admin) |
| **Response** | `SessionIdentity` |

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `sessionId` | `string` | UUID format |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_IDENTITY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `SESSION_NOT_FOUND` | 404 |

---

## Business / Workspace Endpoints

### POST /api/businesses

| Field | Value |
|---|---|
| **Purpose** | Create business workspace and owner membership |
| **Auth** | Required |
| **Permission** | Authenticated user (no tenant context before create) |
| **Request Body** | `CreateBusinessInput` |
| **Validation** | `createBusinessInputSchema` |
| **Response** | `BusinessIdentity` |
| **Audit** | Yes |

**Request body:**

```json
{
  "name": "Business Name (2-120 chars)",
  "slug": "business-slug (3-64 chars, lowercase alphanumeric + hyphens)",
  "timezone": "Asia/Tehran (optional, default: Asia/Tehran)",
  "locale": "fa (optional, default: fa)"
}
```

`createdByUserId` is resolved server-side from the authenticated user — **not accepted from client**.

The service layer automatically creates an OWNER membership for the creating user.

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `BUSINESS_SLUG_ALREADY_EXISTS` | 409 |

---

### GET /api/businesses

| Field | Value |
|---|---|
| **Purpose** | List businesses visible to current user |
| **Auth** | Required |
| **Permission** | Authenticated user (returns only businesses with active membership) |
| **Response** | `readonly BusinessIdentity[]` |

**Query params:**

| Param | Type | Default |
|---|---|---|
| `includeInactive` | `boolean` | `false` |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `UNAUTHENTICATED` | 401 |
| `INVALID_TENANCY_INPUT` | 400 |

---

### GET /api/businesses/:businessId

| Field | Value |
|---|---|
| **Purpose** | Get business by ID after membership check |
| **Auth** | Required |
| **Permission** | `business.read` |
| **Tenant Context** | Required |
| **Response** | `BusinessIdentity \| null` |

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `businessId` | `string` | UUID format |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `TENANT_ACCESS_DENIED` | 403 |
| `BUSINESS_NOT_FOUND` | 404 |

---

### PATCH /api/businesses/:businessId

| Field | Value |
|---|---|
| **Purpose** | Update business settings |
| **Auth** | Required |
| **Permission** | `business.update` |
| **Tenant Context** | Required |
| **Request Body** | `UpdateBusinessInput` (without `businessId` in body — supplied by route param) |
| **Validation** | `updateBusinessInputSchema` |
| **Response** | `BusinessIdentity` |
| **Audit** | Yes |

**Request body:**

```json
{
  "name": "Updated Name",
  "slug": "updated-slug",
  "timezone": "Europe/London",
  "locale": "en"
}
```

At least one update field must be provided. `businessId` comes from the route param and is merged server-side. `status` updates are restricted to admin/owner roles.

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `BUSINESS_NOT_FOUND` | 404 |
| `BUSINESS_SLUG_ALREADY_EXISTS` | 409 |

---

## Membership Endpoints

### GET /api/businesses/:businessId/memberships

| Field | Value |
|---|---|
| **Purpose** | List memberships for a business |
| **Auth** | Required |
| **Permission** | `members.read` |
| **Tenant Context** | Required |
| **Response** | `readonly BusinessMembershipIdentity[]` |

**Query params:**

| Param | Type | Default |
|---|---|---|
| `includeRemoved` | `boolean` | `false` |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `TENANT_ACCESS_DENIED` | 403 |

---

### POST /api/businesses/:businessId/memberships

| Field | Value |
|---|---|
| **Purpose** | Invite or create membership |
| **Auth** | Required |
| **Permission** | `members.invite` |
| **Tenant Context** | Required |
| **Request Body** | `CreateMembershipInput` (without `businessId` — supplied by route param) |
| **Validation** | `createMembershipInputSchema` |
| **Response** | `BusinessMembershipIdentity` |
| **Audit** | Yes |

**Request body:**

```json
{
  "userId": "uuid",
  "role": "VIEWER (optional, default: VIEWER)",
  "status": "INVITED (optional, default: INVITED)"
}
```

`businessId` comes from the route param. `invitedByUserId` is resolved server-side from the authenticated user.

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `MEMBERSHIP_ALREADY_EXISTS` | 409 |

---

### PATCH /api/businesses/:businessId/memberships/:membershipId/role

| Field | Value |
|---|---|
| **Purpose** | Change member role |
| **Auth** | Required |
| **Permission** | `members.change_role` |
| **Tenant Context** | Required |
| **Request Body** | `UpdateMembershipRoleInput` (without `membershipId` — supplied by route param) |
| **Validation** | `updateMembershipRoleInputSchema` |
| **Response** | `BusinessMembershipIdentity` |
| **Audit** | Yes |

**Request body:**

```json
{
  "role": "ADMIN"
}
```

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `businessId` | `string` | UUID format |
| `membershipId` | `string` | UUID format |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `MEMBERSHIP_NOT_FOUND` | 404 |
| `LAST_OWNER_REMOVAL_DENIED` | 409 |

---

### PATCH /api/businesses/:businessId/memberships/:membershipId/status

| Field | Value |
|---|---|
| **Purpose** | Change membership status |
| **Auth** | Required |
| **Permission** | `members.change_role` or `members.remove` (depending on status transition) |
| **Tenant Context** | Required |
| **Request Body** | `UpdateMembershipStatusInput` (without `membershipId` — supplied by route param) |
| **Validation** | `updateMembershipStatusInputSchema` |
| **Response** | `BusinessMembershipIdentity` |
| **Audit** | Yes |

**Request body:**

```json
{
  "status": "ACTIVE",
  "joinedAt": "ISO-8601 (optional)"
}
```

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `businessId` | `string` | UUID format |
| `membershipId` | `string` | UUID format |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `MEMBERSHIP_NOT_FOUND` | 404 |

---

### DELETE /api/businesses/:businessId/memberships/:membershipId

| Field | Value |
|---|---|
| **Purpose** | Remove membership (sets status to `REMOVED`) |
| **Auth** | Required |
| **Permission** | `members.remove` |
| **Tenant Context** | Required |
| **Response** | `BusinessMembershipIdentity` |
| **Audit** | Yes |

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `businessId` | `string` | UUID format |
| `membershipId` | `string` | UUID format |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_TENANCY_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `MEMBERSHIP_NOT_FOUND` | 404 |
| `LAST_OWNER_REMOVAL_DENIED` | 409 |

---

## Authorization Endpoints

### POST /api/authz/evaluate

| Field | Value |
|---|---|
| **Purpose** | Evaluate whether current user role has a permission |
| **Auth** | Required |
| **Request Body** | `AccessCheckInput` |
| **Validation** | `accessCheckInputSchema` |
| **Response** | `AccessDecision` |

**Request body:**

```json
{
  "userId": "uuid",
  "businessId": "uuid",
  "role": "ADMIN",
  "permission": "members.invite"
}
```

**Response body (success):**

```json
{
  "ok": true,
  "data": {
    "allowed": true,
    "reason": "optional string"
  }
}
```

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_AUTHZ_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `TENANT_ACCESS_DENIED` | 403 |

---

### POST /api/authz/require

| Field | Value |
|---|---|
| **Purpose** | Require a permission; returns `ACCESS_DENIED` when not allowed |
| **Auth** | Required |
| **Request Body** | `RequirePermissionInput` |
| **Response** | `AccessDecision` |

**Request body:**

```json
{
  "userId": "uuid",
  "businessId": "uuid",
  "role": "VIEWER",
  "permission": "business.update"
}
```

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_AUTHZ_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `TENANT_ACCESS_DENIED` | 403 |

---

### GET /api/authz/roles/:role/permissions

| Field | Value |
|---|---|
| **Purpose** | List permissions for a given role |
| **Auth** | Required |
| **Permission** | `settings.read` or internal admin policy |
| **Response** | `readonly AuthzPermission[]` |

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `role` | `string` | One of: `OWNER`, `ADMIN`, `OPERATOR`, `VIEWER` |

**Response body (success):**

```json
{
  "ok": true,
  "data": [
    "business.read",
    "business.update",
    "members.read",
    "..."
  ]
}
```

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_AUTHZ_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |

---

## Audit Endpoints

### GET /api/businesses/:businessId/audit-events

| Field | Value |
|---|---|
| **Purpose** | List audit events for a business |
| **Auth** | Required |
| **Permission** | `audit.read` |
| **Tenant Context** | Required |
| **Response** | `readonly AuditEventIdentity[]` |

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `businessId` | `string` | UUID format |

**Query params:**

| Param | Type | Required |
|---|---|---|
| `actorUserId` | `string (UUID)` | No |
| `action` | `string` | No |
| `targetType` | `string` | No |
| `targetId` | `string` | No |
| `result` | `AuditResultValue` (`SUCCESS`, `DENIED`, `FAILED`) | No |
| `actorType` | `AuditActorTypeValue` (`USER`, `SYSTEM`, `AI_RECEPTIONIST`) | No |
| `limit` | `number` (max: 100, default: 50) | No |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_AUDIT_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `TENANT_ACCESS_DENIED` | 403 |

---

### GET /api/businesses/:businessId/audit-events/:auditEventId

| Field | Value |
|---|---|
| **Purpose** | Find audit event by ID |
| **Auth** | Required |
| **Permission** | `audit.read` |
| **Tenant Context** | Required |
| **Response** | `AuditEventIdentity \| null` |

**Route params:**

| Param | Type | Validation |
|---|---|---|
| `businessId` | `string` | UUID format |
| `auditEventId` | `string` | UUID format |

**Errors:**

| Error Code | HTTP Status |
|---|---|
| `INVALID_AUDIT_INPUT` | 400 |
| `UNAUTHENTICATED` | 401 |
| `ACCESS_DENIED` | 403 |
| `AUDIT_EVENT_NOT_FOUND` | 404 |

---

## Route Parameter Rules

- Route params (`businessId`, `membershipId`, `auditEventId`, `sessionId`, `userId`, `role`) are parsed and validated using Zod (UUID format or enum) before any service call.
- `businessId` route param must match the resolved tenant access — the server calls `resolveTenantContext(userId, businessId)` to validate membership.
- `membershipId` route param must be checked against the `businessId` from the route — membership must belong to the specified business.
- `auditEventId` route param must be checked against `businessId` where applicable — audit events must belong to the specified business.
- Request body must **not** override trusted route params. When both body and route param supply the same field (e.g., `businessId`, `membershipId`), the route param takes precedence and the body field is ignored or rejected.

---

## Request Validation Rules

- Use existing domain Zod schemas (`createUserInputSchema`, `updateUserInputSchema`, `createBusinessInputSchema`, etc.) wherever possible.
- Combine route params with body **only after** individual validation passes for both.
- Reject unknown or malformed fields (Zod strict mode or `.strip()` as appropriate).
- Normalize email and slug through the service layer (email lowercasing, slug lowercasing and regex validation are handled by Zod transforms).
- Never trust `role` or `permission` from client request bodies without server-side verification against the resolved membership.

---

## Audit Rules

The following operations are audit-relevant and must produce audit events:

| Operation | Audit Action |
|---|---|
| Update business settings | `business.update` |
| Invite member | `members.invite` |
| Remove member | `members.remove` |
| Change member role | `members.change_role` |
| Assign conversation (future) | `conversations.assign` |
| Close conversation (future) | `conversations.close` |
| Approve AI draft (future) | `ai_drafts.approve` |
| Update settings (future) | `settings.update` |

For this task, only tenant/identity/audit API contracts are designed. Conversation, AI, and settings audit actions are listed for completeness but are **out of scope**.

Sensitive permission denials (as defined by `SENSITIVE_PERMISSIONS` in `authz/permissions.ts`) may also be audit-logged with `result: 'DENIED'`.

---

## Non-Goals

- No route implementation
- No middleware
- No auth provider integration (Clerk, NextAuth, etc.)
- No frontend UI
- No OpenAPI generation
- No customer/conversation/message APIs
- No channel APIs
- No AI APIs
- No billing APIs

---

## Open Questions

| # | Question | Impact |
|---|---|---|
| 1 | Exact auth provider (Clerk, NextAuth, custom) | Session endpoint internals, middleware shape |
| 2 | Whether session creation endpoint is public or internal-only | Endpoint access policy |
| 3 | Active workspace persistence strategy (cookie, DB, or header) | How `businessId` is communicated per-request |
| 4 | Admin/internal user lookup policy for `GET /api/identity/users/:userId` | Permission requirements for cross-tenant lookup |
| 5 | Audit event redaction policy for sensitive metadata | Whether metadata is sanitized before API response |

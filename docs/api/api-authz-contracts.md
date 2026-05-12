# API Authorization Contracts

## Purpose

Define planned server-side authorization behavior for tenant and identity APIs.

This document is **design only**. It does not implement middleware, route handlers, or auth provider integration.

---

## Core Rules

1. **Authenticated user is required** for all protected routes. No anonymous access to any endpoint defined in the API contracts.
2. **Tenant-scoped routes require active membership.** The server calls `resolveTenantContext(userId, businessId)` and verifies the user has an `ACTIVE` membership.
3. **Permission checks are server-side.** The `evaluateAccess` or `requirePermission` functions from the authz service are called before any mutation.
4. **UI permission checks are advisory only.** The frontend may hide buttons based on role, but the server always re-evaluates.
5. **Client-provided `businessId` is never sufficient.** It must be validated against the user's actual membership records.
6. **Route-level authorization must happen before service mutation.** The sequence is: authenticate → resolve tenant → check permission → validate input → call service.
7. **Sensitive denials may be audit-relevant.** Denied access to sensitive permissions (as defined by `SENSITIVE_PERMISSIONS`) can produce audit events with `result: 'DENIED'`.

---

## Authorization Flow

The following sequence applies to every protected, tenant-scoped endpoint:

```
1. Authenticate request
   └─ Resolve current user identity from request context
   └─ If no valid identity → return UNAUTHENTICATED (401)

2. Resolve current user
   └─ Look up user by authenticated identity
   └─ If user not found or suspended → return USER_NOT_FOUND (404)

3. Resolve business/workspace context (when tenant-scoped)
   └─ Extract businessId from route params
   └─ Call resolveTenantContext(userId, businessId)
   └─ If no active membership → return TENANT_ACCESS_DENIED (403)
   └─ Result: TenantContext { businessId, userId, membershipId, role }

4. Load membership
   └─ Membership is already loaded in step 3 as part of TenantContext
   └─ Role is available from TenantContext.role

5. Evaluate permission
   └─ Call evaluateAccess({ userId, businessId, role, permission })
   └─ If not allowed → return ACCESS_DENIED (403)
   └─ If sensitive permission denied → optionally audit log

6. Validate request body
   └─ Parse and validate using domain Zod schemas
   └─ Merge route params (trusted) with validated body
   └─ If validation fails → return INVALID_*_INPUT (400)

7. Call service
   └─ Invoke the appropriate domain service method
   └─ Return success envelope with data

8. Record audit event (when applicable)
   └─ Create audit event with actor, action, target, result
   └─ Audit failures do not block response (policy deferred)
```

> **Note:** Validation order may validate safe route params (e.g., UUID format) before auth for early rejection of malformed URLs, but **mutation must not happen before authz**.

---

## Route Authorization Matrix

| Route Pattern | Method | Permission | Tenant Context Required | Audit Relevant |
|---|---|---|---|---|
| `/api/identity/me` | GET | Authenticated user | No | No |
| `/api/identity/me` | PATCH | Authenticated user | No | Maybe |
| `/api/identity/users/:userId` | GET | `members.read` or admin | Depends on policy | No |
| `/api/identity/sessions` | POST | Internal/system | No | No |
| `/api/identity/sessions` | GET | Authenticated user | No | No |
| `/api/identity/sessions/:sessionId/revoke` | POST | Authenticated user | No | No |
| `/api/businesses` | GET | Authenticated user | No | No |
| `/api/businesses` | POST | Authenticated user | No (pre-create) | Yes |
| `/api/businesses/:businessId` | GET | `business.read` | Yes | No |
| `/api/businesses/:businessId` | PATCH | `business.update` | Yes | Yes |
| `/api/businesses/:businessId/memberships` | GET | `members.read` | Yes | No |
| `/api/businesses/:businessId/memberships` | POST | `members.invite` | Yes | Yes |
| `/api/businesses/:businessId/memberships/:membershipId/role` | PATCH | `members.change_role` | Yes | Yes |
| `/api/businesses/:businessId/memberships/:membershipId/status` | PATCH | `members.change_role` / `members.remove` | Yes | Yes |
| `/api/businesses/:businessId/memberships/:membershipId` | DELETE | `members.remove` | Yes | Yes |
| `/api/businesses/:businessId/audit-events` | GET | `audit.read` | Yes | No |
| `/api/businesses/:businessId/audit-events/:auditEventId` | GET | `audit.read` | Yes | No |
| `/api/authz/evaluate` | POST | Authenticated user | Maybe | No |
| `/api/authz/require` | POST | Authenticated user | Maybe | No |
| `/api/authz/roles/:role/permissions` | GET | `settings.read` or admin | No | No |

---

## Permission Source

- Current permissions are **hardcoded** in `src/domains/authz/permissions.ts` via the `ROLE_PERMISSIONS` map.
- There is **no database-backed permission table** in MVP.
- `Role`, `Permission`, and `RolePermission` database models are **deferred** until custom roles are needed.
- Custom roles are **deferred** — all roles in MVP are: `OWNER`, `ADMIN`, `OPERATOR`, `VIEWER`.

### Current Role → Permission Summary

| Role | Permissions |
|---|---|
| **OWNER** | All permissions (21 total) |
| **ADMIN** | All except `business.delete` |
| **OPERATOR** | `customers.*`, `conversations.*`, `messages.*`, `ai_drafts.*` |
| **VIEWER** | `business.read`, `customers.read`, `conversations.read`, `messages.read` |

See `src/domains/authz/permissions.ts` → `ROLE_PERMISSIONS` for the complete mapping.

---

## Tenant Context Contract

When a tenant-scoped route is accessed, the server resolves a `TenantContext`:

```typescript
interface TenantContext {
  businessId: string;   // UUID — the target business
  userId: string;       // UUID — the authenticated user
  membershipId: string; // UUID — the user's active membership record
  role: MembershipRoleValue; // OWNER | ADMIN | OPERATOR | VIEWER
}
```

This context is resolved by `resolveTenantContext({ userId, businessId })` in the tenancy repository, which:

1. Looks up the user's membership for the given business
2. Verifies the membership status is `ACTIVE`
3. Returns the membership ID and role
4. Returns `TENANT_ACCESS_DENIED` if no active membership exists

---

## Denial Behavior

| Condition | Error Code | HTTP Status | Notes |
|---|---|---|---|
| No authenticated user | `UNAUTHENTICATED` | 401 | Must authenticate first |
| Authenticated but no active membership | `TENANT_ACCESS_DENIED` | 403 | Do not reveal if business exists |
| Authenticated with membership but lacks permission | `ACCESS_DENIED` | 403 | Do not reveal which permission was checked |
| Cross-tenant resource request | `TENANT_ACCESS_DENIED` | 403 | Do not expose cross-tenant metadata |
| Last owner protection | `LAST_OWNER_REMOVAL_DENIED` | 409 | Business-preserving constraint |

---

## Audit-Relevant Authorization Events

The following events should produce audit records:

| Event | Audit Action | Audit Result |
|---|---|---|
| Denied sensitive permission | Varies by permission | `DENIED` |
| Member invited | `members.invite` | `SUCCESS` |
| Member removed | `members.remove` | `SUCCESS` |
| Role changed | `members.change_role` | `SUCCESS` |
| Business settings updated | `business.update` | `SUCCESS` |
| Last-owner protection denial | `members.remove` or `members.change_role` | `DENIED` |

Sensitive permissions that trigger audit on denial are defined in `SENSITIVE_PERMISSIONS` (`src/domains/authz/permissions.ts`):

- `business.delete`
- `members.invite`
- `members.remove`
- `members.change_role`
- `customers.update`
- `conversations.assign`
- `conversations.close`
- `ai_drafts.approve`
- `settings.update`

---

## Non-Goals

- No middleware implementation
- No API route implementation
- No auth provider implementation (Clerk, NextAuth, custom)
- No custom role system
- No database permission lookup
- No session cookie/token handling
- No RBAC admin UI

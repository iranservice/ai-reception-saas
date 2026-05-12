# API Error Contracts

## Purpose

Define planned API error envelope, HTTP status mapping, and domain error code handling for the tenant and identity API layer.

This document is **design only**. It does not implement error mappers, logging, or runtime error handling.

---

## Error Envelope

All API error responses use a consistent envelope:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Optional Future Fields

The following fields may be added in future iterations but are **not implemented** in this design phase:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "requestId": "string — for tracing (future)",
    "details": {} 
  }
}
```

`requestId` is **not implemented yet**. `details` may carry field-level validation errors in a future version.

---

## Success Envelope

All API success responses use a consistent envelope:

```json
{
  "ok": true,
  "data": {}
}
```

This mirrors the `ActionResult<T>` type from `src/lib/result.ts`:

```typescript
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

---

## HTTP Status Mapping

| Error Code | HTTP Status | Domain | Notes |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | Auth | No valid authenticated user in request context |
| `ACCESS_DENIED` | 403 | Authz | Permission check failed for authenticated user |
| `TENANT_ACCESS_DENIED` | 403 | Tenancy | No active membership for the requested business |
| `INVALID_IDENTITY_INPUT` | 400 | Identity | Zod validation failed for identity input |
| `INVALID_TENANCY_INPUT` | 400 | Tenancy | Zod validation failed for tenancy input |
| `INVALID_AUTHZ_INPUT` | 400 | Authz | Zod validation failed for authz input |
| `INVALID_AUDIT_INPUT` | 400 | Audit | Zod validation failed for audit input |
| `USER_NOT_FOUND` | 404 | Identity | User ID does not resolve to a record |
| `SESSION_NOT_FOUND` | 404 | Identity | Session ID does not resolve to a record |
| `SESSION_REVOKED` | 400 | Identity | Session has already been revoked |
| `SESSION_EXPIRED` | 400 | Identity | Session has expired |
| `BUSINESS_NOT_FOUND` | 404 | Tenancy | Business ID does not resolve to a record |
| `MEMBERSHIP_NOT_FOUND` | 404 | Tenancy | Membership ID does not resolve to a record |
| `MEMBERSHIP_INACTIVE` | 400 | Tenancy | Membership exists but is not in ACTIVE status |
| `AUDIT_EVENT_NOT_FOUND` | 404 | Audit | Audit event ID does not resolve to a record |
| `USER_EMAIL_ALREADY_EXISTS` | 409 | Identity | Email uniqueness constraint violation |
| `BUSINESS_SLUG_ALREADY_EXISTS` | 409 | Tenancy | Slug uniqueness constraint violation |
| `MEMBERSHIP_ALREADY_EXISTS` | 409 | Tenancy | User already has a membership for this business |
| `LAST_OWNER_REMOVAL_DENIED` | 409 | Tenancy | Cannot remove or demote last OWNER of a business |
| `UNKNOWN_PERMISSION` | 400 | Authz | Permission string is not in `AUTHZ_PERMISSION_VALUES` |
| `IDENTITY_REPOSITORY_ERROR` | 500 | Identity | Unexpected persistence failure in identity repository |
| `TENANCY_REPOSITORY_ERROR` | 500 | Tenancy | Unexpected persistence failure in tenancy repository |
| `AUDIT_REPOSITORY_ERROR` | 500 | Audit | Unexpected persistence failure in audit repository |
| `AUDIT_WRITE_FAILED` | 500 | Audit | Audit event creation failed |

---

## Domain Error Groups

### Identity Errors

Error codes defined in `IDENTITY_ERROR_CODES` (`src/domains/identity/service.ts`):

- `USER_NOT_FOUND` — User lookup returned no result
- `USER_EMAIL_ALREADY_EXISTS` — Email uniqueness violation during creation
- `SESSION_NOT_FOUND` — Session lookup returned no result
- `SESSION_REVOKED` — Operation on an already-revoked session
- `SESSION_EXPIRED` — Operation on an expired session
- `INVALID_IDENTITY_INPUT` — Input failed Zod validation

### Tenancy Errors

Error codes defined in `TENANCY_ERROR_CODES` (`src/domains/tenancy/service.ts`):

- `BUSINESS_NOT_FOUND` — Business lookup returned no result
- `BUSINESS_SLUG_ALREADY_EXISTS` — Slug uniqueness violation
- `MEMBERSHIP_NOT_FOUND` — Membership lookup returned no result
- `MEMBERSHIP_ALREADY_EXISTS` — Duplicate membership creation attempt
- `MEMBERSHIP_INACTIVE` — Membership exists but is not ACTIVE
- `LAST_OWNER_REMOVAL_DENIED` — Last owner protection triggered
- `INVALID_TENANCY_INPUT` — Input failed Zod validation
- `TENANT_ACCESS_DENIED` — No active membership for the business

### Authz Errors

Error codes defined in `AUTHZ_ERROR_CODES` (`src/domains/authz/service.ts`):

- `ACCESS_DENIED` — Role does not have the required permission
- `UNKNOWN_PERMISSION` — Permission string is not recognized
- `INVALID_AUTHZ_INPUT` — Input failed Zod validation

### Audit Errors

Error codes defined in `AUDIT_ERROR_CODES` (`src/domains/audit/service.ts`):

- `AUDIT_EVENT_NOT_FOUND` — Audit event lookup returned no result
- `INVALID_AUDIT_INPUT` — Input failed Zod validation
- `AUDIT_WRITE_FAILED` — Audit event creation failed at service level

### Repository Errors

Repository-level error codes (used in catch blocks within repository implementations):

- `IDENTITY_REPOSITORY_ERROR` — From `src/domains/identity/repository.ts`
- `TENANCY_REPOSITORY_ERROR` — From `src/domains/tenancy/repository.ts`
- `AUDIT_REPOSITORY_ERROR` — From `src/domains/audit/repository.ts`

### Authentication Errors

- `UNAUTHENTICATED` — Not defined in a domain error code array; emitted by API middleware when no valid user identity is resolved

---

## Validation Error Policy

- **Client receives a generic invalid input code** (e.g., `INVALID_IDENTITY_INPUT`) — not individual field errors.
- **Detailed field-level errors are deferred** to a future version that may include a `details` object in the error envelope.
- **Server logs may contain detailed validation data** for debugging — but this is a future logging concern, not an API contract concern.
- **Sensitive data must not leak in validation errors** — email addresses, slugs, and internal IDs should not be echoed back in error messages beyond what the client already sent.

---

## Security Error Policy

- **Do not reveal whether inaccessible tenant resources exist.** If a user requests a business they have no membership for, return `TENANT_ACCESS_DENIED` (403) rather than `BUSINESS_NOT_FOUND` (404).
- **Access denied should be generic.** Do not include the specific permission that was checked or the user's role in the error message.
- **Tenant access denial should not expose cross-tenant metadata.** The response must not include the business name, slug, or any details about the target tenant.
- **`UNAUTHENTICATED` and `ACCESS_DENIED` are separate.** 401 means no valid identity was resolved; 403 means the identity was resolved but lacks the required permission or membership.

---

## Repository Error Policy

- **Repository errors map to HTTP 500.** These indicate unexpected persistence failures (database connection issues, constraint violations not handled by the service layer, etc.).
- **Raw database errors are never returned to clients.** The repository catches all exceptions and returns generic `*_REPOSITORY_ERROR` codes with safe messages.
- **Unique constraint conflicts should map to 409 when explicitly handled.** The service layer is responsible for detecting known constraint violations (e.g., email uniqueness, slug uniqueness, duplicate membership) and returning the appropriate domain error code (e.g., `USER_EMAIL_ALREADY_EXISTS`, `BUSINESS_SLUG_ALREADY_EXISTS`).
- **Unknown repository errors should produce a generic message** such as `"Identity repository operation failed"` — never leaking SQL errors, table names, or column names.

---

## Audit Error Policy

- **Failed audit writes should not expose internal storage details.** `AUDIT_WRITE_FAILED` returns a generic message; raw DB errors are not included.
- **Future critical audit failures may block sensitive operations.** For example, if auditing a `members.remove` action fails, the removal itself could be rolled back. This policy is **deferred** and not enforced in the current design.
- **Non-critical audit failure policy is deferred.** Whether non-critical audit failures (e.g., logging a read action) silently fail or are retried is a future implementation decision.

---

## Non-Goals

- No runtime error mapper implementation
- No `requestId` implementation
- No logging implementation
- No field-level error response implementation
- No error serialization middleware
- No error monitoring/alerting integration

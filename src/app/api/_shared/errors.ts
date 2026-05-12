// ===========================================================================
// API Shared — Error Status Mapping
//
// Maps domain error codes to HTTP status codes.
// Matches the table in docs/api/api-error-contracts.md.
// ===========================================================================

/** Map of domain error codes to HTTP status codes */
export const API_ERROR_STATUS_MAP: Record<string, number> = {
  // Authentication
  UNAUTHENTICATED: 401,

  // Authorization
  ACCESS_DENIED: 403,
  TENANT_ACCESS_DENIED: 403,

  // Validation — Identity
  INVALID_IDENTITY_INPUT: 400,

  // Validation — Tenancy
  INVALID_TENANCY_INPUT: 400,

  // Validation — Authz
  INVALID_AUTHZ_INPUT: 400,

  // Validation — Audit
  INVALID_AUDIT_INPUT: 400,

  // Not found
  USER_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  BUSINESS_NOT_FOUND: 404,
  MEMBERSHIP_NOT_FOUND: 404,
  AUDIT_EVENT_NOT_FOUND: 404,

  // Conflict
  USER_EMAIL_ALREADY_EXISTS: 409,
  BUSINESS_SLUG_ALREADY_EXISTS: 409,
  MEMBERSHIP_ALREADY_EXISTS: 409,
  LAST_OWNER_REMOVAL_DENIED: 409,

  // Client errors — domain-specific
  SESSION_REVOKED: 400,
  SESSION_EXPIRED: 400,
  MEMBERSHIP_INACTIVE: 400,
  UNKNOWN_PERMISSION: 400,

  // Repository / internal errors
  IDENTITY_REPOSITORY_ERROR: 500,
  TENANCY_REPOSITORY_ERROR: 500,
  AUDIT_REPOSITORY_ERROR: 500,
  AUDIT_WRITE_FAILED: 500,
};

/**
 * Return the HTTP status code for a domain error code.
 * Defaults to 500 for unknown codes.
 */
export function getHttpStatusForError(code: string): number {
  return API_ERROR_STATUS_MAP[code] ?? 500;
}

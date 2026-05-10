// ===========================================================================
// Audit Domain — Service Interface
//
// Pure service boundary for audit operations.
// No implementation — interface definitions only.
// ===========================================================================

import type { ActionResult } from '@/lib/result';
import type {
  AuditEventIdentity,
  CreateAuditEventInput,
  AuditResultValue,
  AuditActorTypeValue,
} from './types';

// ---------------------------------------------------------------------------
// Service-specific input types
// ---------------------------------------------------------------------------

/** Input for finding an audit event by ID */
export interface FindAuditEventByIdInput {
  readonly auditEventId: string;
}

/** Input for listing audit events with filters */
export interface ListAuditEventsInput {
  readonly businessId?: string;
  readonly actorUserId?: string;
  readonly action?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly result?: AuditResultValue;
  readonly actorType?: AuditActorTypeValue;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Audit service error code constants */
export const AUDIT_ERROR_CODES = [
  'AUDIT_EVENT_NOT_FOUND',
  'INVALID_AUDIT_INPUT',
  'AUDIT_WRITE_FAILED',
] as const;

/** Audit service error code type */
export type AuditErrorCode = (typeof AUDIT_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/** Service boundary for audit operations */
export interface AuditService {
  createAuditEvent(
    input: CreateAuditEventInput,
  ): Promise<ActionResult<AuditEventIdentity>>;

  findAuditEventById(
    input: FindAuditEventByIdInput,
  ): Promise<ActionResult<AuditEventIdentity | null>>;

  listAuditEvents(
    input: ListAuditEventsInput,
  ): Promise<ActionResult<readonly AuditEventIdentity[]>>;
}

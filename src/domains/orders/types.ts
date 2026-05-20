// ===========================================================================
// Orders Domain — Types
//
// Domain-level type definitions for service requests.
// ===========================================================================

import type { JsonValue } from '@/lib/types';

// ---------------------------------------------------------------------------
// Const arrays
// ---------------------------------------------------------------------------

/** Allowed service request status values */
export const SERVICE_REQUEST_STATUS_VALUES = [
  'NEW',
  'PENDING_DOCUMENTS',
  'UNDER_REVIEW',
  'COMPLETED',
  'CANCELLED',
] as const;

/** Service request status type */
export type ServiceRequestStatusValue =
  (typeof SERVICE_REQUEST_STATUS_VALUES)[number];

// ---------------------------------------------------------------------------
// Status transition rules
// ---------------------------------------------------------------------------

/**
 * Valid status transitions for service requests.
 * Map of current status → allowed next statuses.
 */
export const SERVICE_REQUEST_TRANSITIONS: Record<
  ServiceRequestStatusValue,
  readonly ServiceRequestStatusValue[]
> = {
  NEW: ['PENDING_DOCUMENTS', 'UNDER_REVIEW', 'CANCELLED'],
  PENDING_DOCUMENTS: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
} as const;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Domain representation of a service request */
export interface ServiceRequestIdentity {
  id: string;
  businessId: string;
  serviceId: string;
  requestedBy: string;
  status: ServiceRequestStatusValue;
  referenceNo: string;
  notes: string | null;
  metadata: JsonValue | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Input for creating a service request */
export interface CreateServiceRequestInput {
  businessId: string;
  serviceId: string;
  requestedBy: string;
  notes?: string;
  metadata?: JsonValue;
}

/** Input for finding a service request by ID */
export interface FindServiceRequestByIdInput {
  readonly requestId: string;
}

/** Input for listing service requests for a business */
export interface ListServiceRequestsInput {
  readonly businessId: string;
  readonly status?: ServiceRequestStatusValue;
}

/** Input for updating a service request's status */
export interface UpdateServiceRequestStatusInput {
  readonly requestId: string;
  readonly status: ServiceRequestStatusValue;
}

// ===========================================================================
// Orders Domain — Service Interface
//
// Pure service boundary for service request operations.
// ===========================================================================

import type { ActionResult } from '@/lib/result';
import type {
  ServiceRequestIdentity,
  CreateServiceRequestInput,
  FindServiceRequestByIdInput,
  ListServiceRequestsInput,
  UpdateServiceRequestStatusInput,
} from './types';

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Orders service error code constants */
export const ORDERS_ERROR_CODES = [
  'SERVICE_REQUEST_NOT_FOUND',
  'INVALID_ORDER_INPUT',
  'INVALID_SERVICE_REQUEST_TRANSITION',
] as const;

/** Orders service error code type */
export type OrdersErrorCode = (typeof ORDERS_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/** Service boundary for service request operations */
export interface OrdersService {
  createServiceRequest(
    input: CreateServiceRequestInput,
  ): Promise<ActionResult<ServiceRequestIdentity>>;

  findServiceRequestById(
    input: FindServiceRequestByIdInput,
  ): Promise<ActionResult<ServiceRequestIdentity | null>>;

  listServiceRequests(
    input: ListServiceRequestsInput,
  ): Promise<ActionResult<readonly ServiceRequestIdentity[]>>;

  updateServiceRequestStatus(
    input: UpdateServiceRequestStatusInput,
  ): Promise<ActionResult<ServiceRequestIdentity>>;
}

// ===========================================================================
// Orders Domain — Service Implementation
//
// Wires the orders repository into the OrdersService interface.
// Includes status transition validation and reference number generation.
// ===========================================================================

import { err } from '@/lib/result';
import type { OrdersService } from './service';
import type { OrdersRepository } from './repository';
import { SERVICE_REQUEST_TRANSITIONS } from './types';
import type { ServiceRequestStatusValue } from './types';

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface OrdersServiceDeps {
  readonly repository: OrdersRepository;
}

// ---------------------------------------------------------------------------
// Reference number generation
// ---------------------------------------------------------------------------

/**
 * Generates a unique human-readable reference number.
 * Format: SR-YYYYMMDD-XXXXXX (6 random alphanumeric chars)
 */
export function generateReferenceNo(): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I confusion
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return `SR-${date}-${random}`;
}

// ---------------------------------------------------------------------------
// Transition validation
// ---------------------------------------------------------------------------

/**
 * Checks if a status transition is valid according to the lifecycle rules.
 */
export function isValidTransition(
  from: ServiceRequestStatusValue,
  to: ServiceRequestStatusValue,
): boolean {
  const allowed = SERVICE_REQUEST_TRANSITIONS[from];
  return (allowed as readonly string[]).includes(to);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOrdersService(deps: OrdersServiceDeps): OrdersService {
  return {
    async createServiceRequest(input) {
      const referenceNo = generateReferenceNo();
      return deps.repository.createServiceRequest({
        ...input,
        referenceNo,
      });
    },

    findServiceRequestById: (input) =>
      deps.repository.findServiceRequestById(input),

    listServiceRequests: (input) =>
      deps.repository.listServiceRequests(input),

    async updateServiceRequestStatus(input) {
      // Fetch current request to validate transition
      const findResult = await deps.repository.findServiceRequestById({
        requestId: input.requestId,
      });

      if (!findResult.ok) {
        return findResult;
      }

      if (!findResult.data) {
        return err(
          'SERVICE_REQUEST_NOT_FOUND',
          'Service request not found',
        );
      }

      const currentStatus = findResult.data.status;

      if (!isValidTransition(currentStatus, input.status)) {
        return err(
          'INVALID_SERVICE_REQUEST_TRANSITION',
          `Cannot transition from ${currentStatus} to ${input.status}`,
        );
      }

      return deps.repository.updateServiceRequestStatus(input);
    },
  };
}

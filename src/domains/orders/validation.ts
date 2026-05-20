// ===========================================================================
// Orders Domain — Validation
//
// Zod schemas for validating orders domain inputs.
// ===========================================================================

import { z } from 'zod';
import { SERVICE_REQUEST_STATUS_VALUES } from './types';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/** Validates a service request status value */
export const serviceRequestStatusSchema = z.enum(SERVICE_REQUEST_STATUS_VALUES);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * Validates input for creating a service request.
 * businessId and requestedBy are omitted — they come from request context.
 */
export const createServiceRequestInputSchema = z.object({
  serviceId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
});

/** Validates input for updating a service request's status */
export const updateServiceRequestStatusInputSchema = z.object({
  requestId: z.string().uuid(),
  status: serviceRequestStatusSchema,
});

/** Validates a service request ID parameter */
export const serviceRequestIdSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateServiceRequestInputValidated = z.output<
  typeof createServiceRequestInputSchema
>;
export type UpdateServiceRequestStatusInputValidated = z.output<
  typeof updateServiceRequestStatusInputSchema
>;

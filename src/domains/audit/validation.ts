// ===========================================================================
// Audit Domain — Validation
//
// Zod schemas for validating audit domain inputs.
// ===========================================================================

import { z } from 'zod';
import { AUDIT_ACTOR_TYPE_VALUES, AUDIT_RESULT_VALUES } from './types';

// ---------------------------------------------------------------------------
// Field schemas
// ---------------------------------------------------------------------------

const AUDIT_ACTION_REGEX = /^[a-z][a-z0-9_.:-]*$/;

const auditActionSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(AUDIT_ACTION_REGEX, {
    message:
      'Action must start with a lowercase letter and contain only lowercase letters, numbers, dots, underscores, colons, and hyphens',
  });

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/** Validates an audit actor type */
export const auditActorTypeSchema = z.enum(AUDIT_ACTOR_TYPE_VALUES);

/** Validates an audit result */
export const auditResultSchema = z.enum(AUDIT_RESULT_VALUES);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/** Validates input for creating an audit event */
export const createAuditEventInputSchema = z
  .object({
    businessId: z.string().uuid().optional(),
    actorType: auditActorTypeSchema,
    actorUserId: z.string().uuid().optional(),
    action: auditActionSchema,
    targetType: z.string().min(1).max(120).optional(),
    targetId: z.string().min(1).max(160).optional(),
    result: auditResultSchema,
    metadata: z.unknown().optional(),
  })
  .refine(
    (data) => {
      if (data.actorType === 'USER') {
        return data.actorUserId !== undefined && data.actorUserId !== null;
      }
      return true;
    },
    {
      message: 'actorUserId is required when actorType is USER',
      path: ['actorUserId'],
    },
  );

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateAuditEventInputValidated = z.output<
  typeof createAuditEventInputSchema
>;

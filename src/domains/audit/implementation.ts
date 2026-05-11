// ===========================================================================
// Audit Domain — Service Implementation
//
// Concrete AuditService backed by validation + injected repository.
// ===========================================================================

import { z } from 'zod';
import { err } from '@/lib/result';
import type { AuditService } from './service';
import type { AuditRepository } from './repository';
import {
  createAuditEventInputSchema,
  auditResultSchema,
  auditActorTypeSchema,
} from './validation';

// ---------------------------------------------------------------------------
// Local validation helpers
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();

const listAuditEventsInputSchema = z.object({
  businessId: uuidSchema.optional(),
  actorUserId: uuidSchema.optional(),
  action: z.string().min(3).max(120).regex(/^[a-z][a-z0-9_.:-]*$/).optional(),
  targetType: z.string().min(1).max(120).optional(),
  targetId: z.string().min(1).max(160).optional(),
  result: auditResultSchema.optional(),
  actorType: auditActorTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

/** Dependencies for the audit service */
export interface AuditServiceDeps {
  readonly repository: AuditRepository;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a concrete AuditService with validation and injected repository */
export function createAuditService(deps: AuditServiceDeps): AuditService {
  const { repository } = deps;

  return {
    async createAuditEvent(input) {
      const parsed = createAuditEventInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_AUDIT_INPUT', 'Invalid audit input');
      }
      return repository.createAuditEvent(parsed.data);
    },

    async findAuditEventById(input) {
      const parsed = uuidSchema.safeParse(input.auditEventId);
      if (!parsed.success) {
        return err('INVALID_AUDIT_INPUT', 'Invalid audit input');
      }
      return repository.findAuditEventById(input);
    },

    async listAuditEvents(input) {
      const parsed = listAuditEventsInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_AUDIT_INPUT', 'Invalid audit input');
      }
      return repository.listAuditEvents(parsed.data);
    },
  };
}

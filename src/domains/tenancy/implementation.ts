// ===========================================================================
// Tenancy Domain — Service Implementation
//
// Concrete TenancyService backed by validation + injected repository.
// ===========================================================================

import { z } from 'zod';
import { err } from '@/lib/result';
import type { TenancyService } from './service';
import type { TenancyRepository } from './repository';
import {
  createBusinessInputSchema,
  updateBusinessInputSchema,
  createMembershipInputSchema,
  updateMembershipRoleInputSchema,
  updateMembershipStatusInputSchema,
  resolveTenantContextInputSchema,
  businessSlugSchema,
} from './validation';

// ---------------------------------------------------------------------------
// Local validation helpers
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();

const findMembershipInputSchema = z.object({
  businessId: uuidSchema,
  userId: uuidSchema,
});

const listUserBusinessesInputSchema = z.object({
  userId: uuidSchema,
  includeInactive: z.boolean().optional(),
});

const listBusinessMembershipsInputSchema = z.object({
  businessId: uuidSchema,
  includeRemoved: z.boolean().optional(),
});

const removeMembershipInputSchema = z.object({
  membershipId: uuidSchema,
  removedByUserId: uuidSchema,
});

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

/** Dependencies for the tenancy service */
export interface TenancyServiceDeps {
  readonly repository: TenancyRepository;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a concrete TenancyService with validation and injected repository */
export function createTenancyService(deps: TenancyServiceDeps): TenancyService {
  const { repository } = deps;

  return {
    async createBusiness(input) {
      const parsed = createBusinessInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.createBusiness(parsed.data);
    },

    async updateBusiness(input) {
      const parsed = updateBusinessInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.updateBusiness(parsed.data);
    },

    async findBusinessById(input) {
      const parsed = uuidSchema.safeParse(input.businessId);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.findBusinessById(input);
    },

    async findBusinessBySlug(input) {
      const parsed = businessSlugSchema.safeParse(input.slug);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.findBusinessBySlug({ slug: parsed.data });
    },

    async listUserBusinesses(input) {
      const parsed = listUserBusinessesInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.listUserBusinesses(parsed.data);
    },

    async createMembership(input) {
      const parsed = createMembershipInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.createMembership(parsed.data);
    },

    async findMembership(input) {
      const parsed = findMembershipInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.findMembership(parsed.data);
    },

    async findMembershipById(input) {
      const parsed = uuidSchema.safeParse(input.membershipId);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.findMembershipById(input);
    },

    async listBusinessMemberships(input) {
      const parsed = listBusinessMembershipsInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.listBusinessMemberships(parsed.data);
    },

    async updateMembershipRole(input) {
      const parsed = updateMembershipRoleInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.updateMembershipRole(parsed.data);
    },

    async updateMembershipStatus(input) {
      const parsed = updateMembershipStatusInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.updateMembershipStatus(parsed.data);
    },

    async removeMembership(input) {
      const parsed = removeMembershipInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.removeMembership(parsed.data);
    },

    async resolveTenantContext(input) {
      const parsed = resolveTenantContextInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_TENANCY_INPUT', 'Invalid tenancy input');
      }
      return repository.resolveTenantContext(parsed.data);
    },
  };
}

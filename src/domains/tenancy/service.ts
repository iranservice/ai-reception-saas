// ===========================================================================
// Tenancy Domain — Service Interface
//
// Pure service boundary for tenancy operations.
// No implementation — interface definitions only.
// ===========================================================================

import type { ActionResult } from '@/lib/result';
import type {
  BusinessIdentity,
  BusinessMembershipIdentity,
  TenantContext,
  CreateBusinessInput,
  UpdateBusinessInput,
  CreateMembershipInput,
  UpdateMembershipRoleInput,
  UpdateMembershipStatusInput,
  ResolveTenantContextInput,
} from './types';

// ---------------------------------------------------------------------------
// Service-specific input types
// ---------------------------------------------------------------------------

/** Input for finding a business by ID */
export interface FindBusinessByIdInput {
  readonly businessId: string;
}

/** Input for finding a business by slug */
export interface FindBusinessBySlugInput {
  readonly slug: string;
}

/** Input for listing businesses a user belongs to */
export interface ListUserBusinessesInput {
  readonly userId: string;
  readonly includeInactive?: boolean;
}

/** Input for finding a membership by business and user */
export interface FindMembershipInput {
  readonly businessId: string;
  readonly userId: string;
}

/** Input for finding a membership by ID */
export interface FindMembershipByIdInput {
  readonly membershipId: string;
}

/** Input for listing memberships of a business */
export interface ListBusinessMembershipsInput {
  readonly businessId: string;
  readonly includeRemoved?: boolean;
}

/** Input for removing a membership */
export interface RemoveMembershipInput {
  readonly membershipId: string;
  readonly removedByUserId: string;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Tenancy service error code constants */
export const TENANCY_ERROR_CODES = [
  'BUSINESS_NOT_FOUND',
  'BUSINESS_SLUG_ALREADY_EXISTS',
  'MEMBERSHIP_NOT_FOUND',
  'MEMBERSHIP_ALREADY_EXISTS',
  'MEMBERSHIP_INACTIVE',
  'LAST_OWNER_REMOVAL_DENIED',
  'INVALID_TENANCY_INPUT',
  'TENANT_ACCESS_DENIED',
] as const;

/** Tenancy service error code type */
export type TenancyErrorCode = (typeof TENANCY_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/** Service boundary for tenancy (business + membership) operations */
export interface TenancyService {
  createBusiness(
    input: CreateBusinessInput,
  ): Promise<ActionResult<BusinessIdentity>>;

  updateBusiness(
    input: UpdateBusinessInput,
  ): Promise<ActionResult<BusinessIdentity>>;

  findBusinessById(
    input: FindBusinessByIdInput,
  ): Promise<ActionResult<BusinessIdentity | null>>;

  findBusinessBySlug(
    input: FindBusinessBySlugInput,
  ): Promise<ActionResult<BusinessIdentity | null>>;

  listUserBusinesses(
    input: ListUserBusinessesInput,
  ): Promise<ActionResult<readonly BusinessIdentity[]>>;

  createMembership(
    input: CreateMembershipInput,
  ): Promise<ActionResult<BusinessMembershipIdentity>>;

  findMembership(
    input: FindMembershipInput,
  ): Promise<ActionResult<BusinessMembershipIdentity | null>>;

  findMembershipById(
    input: FindMembershipByIdInput,
  ): Promise<ActionResult<BusinessMembershipIdentity | null>>;

  listBusinessMemberships(
    input: ListBusinessMembershipsInput,
  ): Promise<ActionResult<readonly BusinessMembershipIdentity[]>>;

  updateMembershipRole(
    input: UpdateMembershipRoleInput,
  ): Promise<ActionResult<BusinessMembershipIdentity>>;

  updateMembershipStatus(
    input: UpdateMembershipStatusInput,
  ): Promise<ActionResult<BusinessMembershipIdentity>>;

  removeMembership(
    input: RemoveMembershipInput,
  ): Promise<ActionResult<BusinessMembershipIdentity>>;

  resolveTenantContext(
    input: ResolveTenantContextInput,
  ): Promise<ActionResult<TenantContext>>;
}

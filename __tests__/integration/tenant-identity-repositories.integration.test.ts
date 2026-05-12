// ===========================================================================
// Integration Tests — Tenant Identity Repositories
//
// Runs against a real local PostgreSQL database.
// Gated by RUN_INTEGRATION_TESTS=true and requires DATABASE_URL.
// Normal `pnpm test` skips these tests cleanly.
// ===========================================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';

import { createIdentityRepository } from '../../src/domains/identity/repository';
import type { IdentityRepositoryDb } from '../../src/domains/identity/repository';
import { createTenancyRepository } from '../../src/domains/tenancy/repository';
import type { TenancyRepositoryDb } from '../../src/domains/tenancy/repository';
import { createAuditRepository } from '../../src/domains/audit/repository';
import type { AuditRepositoryDb } from '../../src/domains/audit/repository';

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === 'true';

const describeIntegration = integrationEnabled ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Local-only safety guard
// ---------------------------------------------------------------------------

function assertLocalDatabase(url: string): void {
  const lower = url.toLowerCase();
  if (!lower.includes('localhost') && !lower.includes('127.0.0.1')) {
    throw new Error(
      'Integration tests require a local DATABASE_URL (localhost or 127.0.0.1). ' +
        'Refusing to run destructive cleanup against a remote database.',
    );
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper — deletes in dependency-safe order
// ---------------------------------------------------------------------------

async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.auditEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.businessMembership.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();
}

// ---------------------------------------------------------------------------
// DB type adapters
//
// PrismaClient's delegate generics are more complex than the simplified
// RepositoryDb interfaces. These adapters provide a type-safe bridge.
// ---------------------------------------------------------------------------

function identityDb(prisma: PrismaClient): IdentityRepositoryDb {
  return prisma as unknown as IdentityRepositoryDb;
}

function tenancyDb(prisma: PrismaClient): TenancyRepositoryDb {
  return prisma as unknown as TenancyRepositoryDb;
}

function auditDb(prisma: PrismaClient): AuditRepositoryDb {
  return prisma as unknown as AuditRepositoryDb;
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describeIntegration('Tenant identity repositories integration', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required when RUN_INTEGRATION_TESTS=true. ' +
          'Set DATABASE_URL to a local PostgreSQL connection string.',
      );
    }
    assertLocalDatabase(databaseUrl);
    const adapter = new PrismaPg(databaseUrl);
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    if (prisma) {
      await cleanDatabase(prisma);
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  // =========================================================================
  // Identity Repository
  // =========================================================================

  describe('Identity Repository', () => {
    it('can create and read a user', async () => {
      const suffix = randomUUID();
      const repo = createIdentityRepository(identityDb(prisma));

      // Create user
      const createResult = await repo.createUser({
        email: `integration-${suffix}@example.com`,
        name: 'Integration User',
        locale: 'en',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const user = createResult.data;
      expect(user.id).toBeDefined();
      expect(user.email).toBe(`integration-${suffix}@example.com`);
      expect(user.name).toBe('Integration User');
      expect(user.locale).toBe('en');
      expect(user.status).toBe('ACTIVE');
      expect(user.avatarUrl).toBeNull();
      expect(typeof user.createdAt).toBe('string');
      expect(typeof user.updatedAt).toBe('string');
      // Verify ISO string format
      expect(() => new Date(user.createdAt).toISOString()).not.toThrow();

      // Find by ID
      const findByIdResult = await repo.findUserById({ userId: user.id });
      expect(findByIdResult.ok).toBe(true);
      if (findByIdResult.ok) {
        expect(findByIdResult.data).not.toBeNull();
        expect(findByIdResult.data?.id).toBe(user.id);
      }

      // Find by email
      const findByEmailResult = await repo.findUserByEmail({
        email: `integration-${suffix}@example.com`,
      });
      expect(findByEmailResult.ok).toBe(true);
      if (findByEmailResult.ok) {
        expect(findByEmailResult.data).not.toBeNull();
        expect(findByEmailResult.data?.email).toBe(user.email);
      }
    });

    it('can create, list, find, and revoke a session', async () => {
      const suffix = randomUUID();
      const repo = createIdentityRepository(identityDb(prisma));

      // Create user first
      const userResult = await repo.createUser({
        email: `session-${suffix}@example.com`,
        name: 'Session User',
        locale: 'en',
      });
      expect(userResult.ok).toBe(true);
      if (!userResult.ok) return;
      const user = userResult.data;

      // Create session
      const tokenHash = `integration-token-${suffix}`.padEnd(32, '0');
      const expiresAt = new Date(Date.now() + 86400000).toISOString();

      const sessionResult = await repo.createSession({
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: '127.0.0.1',
        userAgent: 'IntegrationTest',
      });
      expect(sessionResult.ok).toBe(true);
      if (!sessionResult.ok) return;
      const session = sessionResult.data;

      expect(session.id).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.tokenHash).toBe(tokenHash);
      expect(session.revokedAt).toBeNull();
      expect(typeof session.expiresAt).toBe('string');
      expect(typeof session.createdAt).toBe('string');

      // Find by ID
      const findResult = await repo.findSessionById({ sessionId: session.id });
      expect(findResult.ok).toBe(true);
      if (findResult.ok) {
        expect(findResult.data).not.toBeNull();
        expect(findResult.data?.id).toBe(session.id);
      }

      // Find by tokenHash
      const findByHashResult = await repo.findSessionByTokenHash({ tokenHash });
      expect(findByHashResult.ok).toBe(true);
      if (findByHashResult.ok) {
        expect(findByHashResult.data).not.toBeNull();
        expect(findByHashResult.data?.tokenHash).toBe(tokenHash);
      }

      // List sessions
      const listResult = await repo.listUserSessions({ userId: user.id });
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.data.length).toBeGreaterThanOrEqual(1);
        expect(listResult.data[0].id).toBe(session.id);
      }

      // Revoke session
      const revokeResult = await repo.revokeSession({ sessionId: session.id });
      expect(revokeResult.ok).toBe(true);
      if (revokeResult.ok) {
        expect(revokeResult.data.revokedAt).not.toBeNull();
        expect(typeof revokeResult.data.revokedAt).toBe('string');
      }
    });
  });

  // =========================================================================
  // Tenancy Repository
  // =========================================================================

  describe('Tenancy Repository', () => {
    it('can create and read a business', async () => {
      const suffix = randomUUID();
      const identityRepo = createIdentityRepository(identityDb(prisma));
      const tenancyRepo = createTenancyRepository(tenancyDb(prisma));

      // Create user first
      const userResult = await identityRepo.createUser({
        email: `biz-owner-${suffix}@example.com`,
        name: 'Biz Owner',
        locale: 'en',
      });
      expect(userResult.ok).toBe(true);
      if (!userResult.ok) return;
      const user = userResult.data;

      // Create business
      const bizResult = await tenancyRepo.createBusiness({
        name: 'Integration Business',
        slug: `int-biz-${suffix}`.slice(0, 64),
        createdByUserId: user.id,
        timezone: 'Asia/Tehran',
        locale: 'fa',
      });
      expect(bizResult.ok).toBe(true);
      if (!bizResult.ok) return;
      const business = bizResult.data;

      expect(business.id).toBeDefined();
      expect(business.name).toBe('Integration Business');
      expect(business.slug).toBe(`int-biz-${suffix}`.slice(0, 64));
      expect(business.status).toBe('ACTIVE');
      expect(business.timezone).toBe('Asia/Tehran');
      expect(business.locale).toBe('fa');
      expect(business.createdByUserId).toBe(user.id);
      expect(typeof business.createdAt).toBe('string');
      expect(typeof business.updatedAt).toBe('string');

      // Find by ID
      const findByIdResult = await tenancyRepo.findBusinessById({
        businessId: business.id,
      });
      expect(findByIdResult.ok).toBe(true);
      if (findByIdResult.ok) {
        expect(findByIdResult.data).not.toBeNull();
        expect(findByIdResult.data?.id).toBe(business.id);
      }

      // Find by slug
      const findBySlugResult = await tenancyRepo.findBusinessBySlug({
        slug: business.slug,
      });
      expect(findBySlugResult.ok).toBe(true);
      if (findBySlugResult.ok) {
        expect(findBySlugResult.data).not.toBeNull();
        expect(findBySlugResult.data?.slug).toBe(business.slug);
      }

      // List user businesses (requires membership)
      await tenancyRepo.createMembership({
        businessId: business.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      });

      const listResult = await tenancyRepo.listUserBusinesses({ userId: user.id });
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.data.length).toBeGreaterThanOrEqual(1);
        expect(listResult.data.some((b) => b.id === business.id)).toBe(true);
      }
    });

    it('can create membership and resolve tenant context', async () => {
      const suffix = randomUUID();
      const identityRepo = createIdentityRepository(identityDb(prisma));
      const tenancyRepo = createTenancyRepository(tenancyDb(prisma));

      // Create user
      const userResult = await identityRepo.createUser({
        email: `member-${suffix}@example.com`,
        name: 'Member User',
        locale: 'en',
      });
      expect(userResult.ok).toBe(true);
      if (!userResult.ok) return;
      const user = userResult.data;

      // Create business
      const bizResult = await tenancyRepo.createBusiness({
        name: 'Tenant Context Biz',
        slug: `ctx-biz-${suffix}`.slice(0, 64),
        createdByUserId: user.id,
        timezone: 'Asia/Tehran',
        locale: 'fa',
      });
      expect(bizResult.ok).toBe(true);
      if (!bizResult.ok) return;
      const business = bizResult.data;

      // Create active OWNER membership
      const memResult = await tenancyRepo.createMembership({
        businessId: business.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      });
      expect(memResult.ok).toBe(true);
      if (!memResult.ok) return;
      const membership = memResult.data;

      // Find by userId/businessId
      const findResult = await tenancyRepo.findMembership({
        userId: user.id,
        businessId: business.id,
      });
      expect(findResult.ok).toBe(true);
      if (findResult.ok) {
        expect(findResult.data).not.toBeNull();
        expect(findResult.data?.id).toBe(membership.id);
      }

      // Find by id
      const findByIdResult = await tenancyRepo.findMembershipById({
        membershipId: membership.id,
      });
      expect(findByIdResult.ok).toBe(true);
      if (findByIdResult.ok) {
        expect(findByIdResult.data).not.toBeNull();
        expect(findByIdResult.data?.role).toBe('OWNER');
      }

      // Resolve tenant context
      const ctxResult = await tenancyRepo.resolveTenantContext({
        userId: user.id,
        businessId: business.id,
      });
      expect(ctxResult.ok).toBe(true);
      if (ctxResult.ok) {
        expect(ctxResult.data.userId).toBe(user.id);
        expect(ctxResult.data.businessId).toBe(business.id);
        expect(ctxResult.data.membershipId).toBe(membership.id);
        expect(ctxResult.data.role).toBe('OWNER');
      }
    });

    it('removeMembership sets status REMOVED and denies tenant context', async () => {
      const suffix = randomUUID();
      const identityRepo = createIdentityRepository(identityDb(prisma));
      const tenancyRepo = createTenancyRepository(tenancyDb(prisma));

      // Create user + business + active membership
      const userResult = await identityRepo.createUser({
        email: `remove-${suffix}@example.com`,
        name: 'Remove User',
        locale: 'en',
      });
      expect(userResult.ok).toBe(true);
      if (!userResult.ok) return;
      const user = userResult.data;

      const bizResult = await tenancyRepo.createBusiness({
        name: 'Remove Biz',
        slug: `rm-biz-${suffix}`.slice(0, 64),
        createdByUserId: user.id,
      });
      expect(bizResult.ok).toBe(true);
      if (!bizResult.ok) return;
      const business = bizResult.data;

      const memResult = await tenancyRepo.createMembership({
        businessId: business.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      });
      expect(memResult.ok).toBe(true);
      if (!memResult.ok) return;
      const membership = memResult.data;

      // Remove membership
      const removeResult = await tenancyRepo.removeMembership({
        membershipId: membership.id,
        removedByUserId: user.id,
      });
      expect(removeResult.ok).toBe(true);
      if (removeResult.ok) {
        expect(removeResult.data.status).toBe('REMOVED');
      }

      // Resolve tenant context should deny
      const ctxResult = await tenancyRepo.resolveTenantContext({
        userId: user.id,
        businessId: business.id,
      });
      expect(ctxResult.ok).toBe(false);
      if (!ctxResult.ok) {
        expect(ctxResult.error.code).toBe('TENANT_ACCESS_DENIED');
      }
    });
  });

  // =========================================================================
  // Audit Repository
  // =========================================================================

  describe('Audit Repository', () => {
    it('can create, find, and list audit events', async () => {
      const suffix = randomUUID();
      const identityRepo = createIdentityRepository(identityDb(prisma));
      const tenancyRepo = createTenancyRepository(tenancyDb(prisma));
      const auditRepo = createAuditRepository(auditDb(prisma));

      // Setup: create user + business + membership
      const userResult = await identityRepo.createUser({
        email: `audit-${suffix}@example.com`,
        name: 'Audit User',
        locale: 'en',
      });
      expect(userResult.ok).toBe(true);
      if (!userResult.ok) return;
      const user = userResult.data;

      const bizResult = await tenancyRepo.createBusiness({
        name: 'Audit Business',
        slug: `audit-biz-${suffix}`.slice(0, 64),
        createdByUserId: user.id,
      });
      expect(bizResult.ok).toBe(true);
      if (!bizResult.ok) return;
      const business = bizResult.data;

      await tenancyRepo.createMembership({
        businessId: business.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      });

      // Create audit event
      const auditResult = await auditRepo.createAuditEvent({
        businessId: business.id,
        actorType: 'USER',
        actorUserId: user.id,
        action: 'integration.test',
        targetType: 'business',
        targetId: business.id,
        result: 'SUCCESS',
        metadata: { source: 'integration-test' },
      });
      expect(auditResult.ok).toBe(true);
      if (!auditResult.ok) return;
      const auditEvent = auditResult.data;

      expect(auditEvent.id).toBeDefined();
      expect(auditEvent.businessId).toBe(business.id);
      expect(auditEvent.actorType).toBe('USER');
      expect(auditEvent.actorUserId).toBe(user.id);
      expect(auditEvent.action).toBe('integration.test');
      expect(auditEvent.targetType).toBe('business');
      expect(auditEvent.targetId).toBe(business.id);
      expect(auditEvent.result).toBe('SUCCESS');
      expect(auditEvent.metadata).toEqual({ source: 'integration-test' });
      expect(typeof auditEvent.createdAt).toBe('string');
      expect(() => new Date(auditEvent.createdAt).toISOString()).not.toThrow();

      // Find by ID
      const findResult = await auditRepo.findAuditEventById({
        auditEventId: auditEvent.id,
      });
      expect(findResult.ok).toBe(true);
      if (findResult.ok) {
        expect(findResult.data).not.toBeNull();
        expect(findResult.data?.id).toBe(auditEvent.id);
        expect(findResult.data?.metadata).toEqual({ source: 'integration-test' });
      }

      // List by businessId
      const listResult = await auditRepo.listAuditEvents({
        businessId: business.id,
      });
      expect(listResult.ok).toBe(true);
      if (listResult.ok) {
        expect(listResult.data.length).toBeGreaterThanOrEqual(1);
        expect(listResult.data.some((e) => e.id === auditEvent.id)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Cross-Repository Flow
  // =========================================================================

  describe('Cross-Repository Flow', () => {
    it('full tenant identity audit flow works end-to-end', async () => {
      const suffix = randomUUID();
      const identityRepo = createIdentityRepository(identityDb(prisma));
      const tenancyRepo = createTenancyRepository(tenancyDb(prisma));
      const auditRepo = createAuditRepository(auditDb(prisma));

      // 1. Create user
      const userResult = await identityRepo.createUser({
        email: `e2e-${suffix}@example.com`,
        name: 'E2E User',
        locale: 'en',
      });
      expect(userResult.ok).toBe(true);
      if (!userResult.ok) return;
      const user = userResult.data;

      // 2. Create business
      const bizResult = await tenancyRepo.createBusiness({
        name: 'E2E Business',
        slug: `e2e-biz-${suffix}`.slice(0, 64),
        createdByUserId: user.id,
        timezone: 'Asia/Tehran',
        locale: 'fa',
      });
      expect(bizResult.ok).toBe(true);
      if (!bizResult.ok) return;
      const business = bizResult.data;

      // 3. Create membership
      const memResult = await tenancyRepo.createMembership({
        businessId: business.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      });
      expect(memResult.ok).toBe(true);
      if (!memResult.ok) return;
      const membership = memResult.data;

      // 4. Resolve tenant context
      const ctxResult = await tenancyRepo.resolveTenantContext({
        userId: user.id,
        businessId: business.id,
      });
      expect(ctxResult.ok).toBe(true);
      if (!ctxResult.ok) return;
      expect(ctxResult.data.userId).toBe(user.id);
      expect(ctxResult.data.businessId).toBe(business.id);
      expect(ctxResult.data.membershipId).toBe(membership.id);
      expect(ctxResult.data.role).toBe('OWNER');

      // 5. Create session
      const tokenHash = `e2e-token-${suffix}`.padEnd(32, '0');
      const sessionResult = await identityRepo.createSession({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(sessionResult.ok).toBe(true);
      if (!sessionResult.ok) return;
      const session = sessionResult.data;
      expect(session.userId).toBe(user.id);

      // 6. Create audit event
      const auditResult = await auditRepo.createAuditEvent({
        businessId: business.id,
        actorType: 'USER',
        actorUserId: user.id,
        action: 'e2e.flow.completed',
        targetType: 'business',
        targetId: business.id,
        result: 'SUCCESS',
        metadata: { sessionId: session.id, membershipId: membership.id },
      });
      expect(auditResult.ok).toBe(true);
      if (!auditResult.ok) return;

      // 7. Verify all IDs match
      expect(auditResult.data.businessId).toBe(business.id);
      expect(auditResult.data.actorUserId).toBe(user.id);
      expect(auditResult.data.targetId).toBe(business.id);
    });
  });
});

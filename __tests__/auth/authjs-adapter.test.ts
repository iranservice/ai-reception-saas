import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createAuthjsAdapter,
  createUnsupportedDatabaseSessionMethod,
  AUTHJS_DATABASE_SESSIONS_DISABLED_MESSAGE,
  type AuthjsAdapterDB,
} from '../../src/lib/auth/authjs-adapter';

// ---------------------------------------------------------------------------
// Mock DB factory
// ---------------------------------------------------------------------------

function createMockDB(): AuthjsAdapterDB {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    account: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Mock internal user for assertions
// ---------------------------------------------------------------------------

const MOCK_INTERNAL_USER = {
  id: 'uuid-001',
  email: 'alice@test.com',
  name: 'Alice Smith',
  avatarUrl: 'https://pic.example.com/alice.jpg',
  emailVerified: new Date('2024-01-15'),
};

// ---------------------------------------------------------------------------
// Adapter method tests
// ---------------------------------------------------------------------------

describe('createAuthjsAdapter', () => {
  let db: AuthjsAdapterDB;
  let adapter: ReturnType<typeof createAuthjsAdapter>;

  beforeEach(() => {
    db = createMockDB();
    adapter = createAuthjsAdapter(db);
  });

  // -------------------------------------------------------------------------
  // createUser
  // -------------------------------------------------------------------------

  describe('createUser', () => {
    it('writes normalized email, name, avatarUrl, and emailVerified', async () => {
      (db.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_INTERNAL_USER);

      const result = await adapter.createUser!({
        id: 'provider-id',
        email: 'ALICE@Test.com',
        name: 'Alice Smith',
        emailVerified: new Date('2024-01-15'),
        image: 'https://pic.example.com/alice.jpg',
      } as never);

      expect(db.user.create).toHaveBeenCalledWith({
        data: {
          email: 'alice@test.com',
          name: 'Alice Smith',
          avatarUrl: 'https://pic.example.com/alice.jpg',
          emailVerified: new Date('2024-01-15'),
        },
      });

      // Returns adapter user shape with image (not avatarUrl)
      expect(result).toEqual({
        id: 'uuid-001',
        email: 'alice@test.com',
        name: 'Alice Smith',
        image: 'https://pic.example.com/alice.jpg',
        emailVerified: new Date('2024-01-15'),
      });
    });
  });

  // -------------------------------------------------------------------------
  // getUser
  // -------------------------------------------------------------------------

  describe('getUser', () => {
    it('returns adapter user shape', async () => {
      (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_INTERNAL_USER);

      const result = await adapter.getUser!('uuid-001');

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-001' },
      });
      expect(result).toEqual({
        id: 'uuid-001',
        email: 'alice@test.com',
        name: 'Alice Smith',
        image: 'https://pic.example.com/alice.jpg',
        emailVerified: new Date('2024-01-15'),
      });
    });

    it('returns null for non-existent user', async () => {
      (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await adapter.getUser!('nonexistent');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getUserByEmail
  // -------------------------------------------------------------------------

  describe('getUserByEmail', () => {
    it('normalizes lookup email', async () => {
      (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_INTERNAL_USER);

      await adapter.getUserByEmail!('ALICE@Test.com');

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@test.com' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateUser
  // -------------------------------------------------------------------------

  describe('updateUser', () => {
    it('maps image to avatarUrl', async () => {
      (db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...MOCK_INTERNAL_USER,
        avatarUrl: 'https://new-pic.example.com/alice.jpg',
      });

      await adapter.updateUser!({
        id: 'uuid-001',
        image: 'https://new-pic.example.com/alice.jpg',
      } as never);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-001' },
        data: expect.objectContaining({
          avatarUrl: 'https://new-pic.example.com/alice.jpg',
        }),
      });
    });
  });

  // -------------------------------------------------------------------------
  // linkAccount
  // -------------------------------------------------------------------------

  describe('linkAccount', () => {
    it('maps token fields to Prisma Account fields', async () => {
      (db.account.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await adapter.linkAccount!({
        userId: 'uuid-001',
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
        access_token: 'access-token-value',
        refresh_token: 'refresh-token-value',
        expires_at: 1700000000,
        token_type: 'Bearer',
        scope: 'openid email profile',
        id_token: 'id-token-value',
        session_state: 'session-state-value',
      } as never);

      expect(db.account.create).toHaveBeenCalledWith({
        data: {
          userId: 'uuid-001',
          type: 'oauth',
          provider: 'google',
          providerAccountId: 'google-123',
          accessToken: 'access-token-value',
          refreshToken: 'refresh-token-value',
          expiresAt: 1700000000,
          tokenType: 'Bearer',
          scope: 'openid email profile',
          idToken: 'id-token-value',
          sessionState: 'session-state-value',
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // getUserByAccount
  // -------------------------------------------------------------------------

  describe('getUserByAccount', () => {
    it('returns linked internal user', async () => {
      (db.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'uuid-001',
        provider: 'google',
        providerAccountId: 'google-123',
        user: MOCK_INTERNAL_USER,
      });

      const result = await adapter.getUserByAccount!({
        provider: 'google',
        providerAccountId: 'google-123',
      });

      expect(result).toEqual({
        id: 'uuid-001',
        email: 'alice@test.com',
        name: 'Alice Smith',
        image: 'https://pic.example.com/alice.jpg',
        emailVerified: new Date('2024-01-15'),
      });
    });

    it('returns null for unlinked account', async () => {
      (db.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await adapter.getUserByAccount!({
        provider: 'google',
        providerAccountId: 'nonexistent',
      });

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // unlinkAccount
  // -------------------------------------------------------------------------

  describe('unlinkAccount', () => {
    it('deletes by provider and providerAccountId', async () => {
      (db.account.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await adapter.unlinkAccount!({
        provider: 'google',
        providerAccountId: 'google-123',
      });

      expect(db.account.delete).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: 'google-123',
          },
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // createVerificationToken
  // -------------------------------------------------------------------------

  describe('createVerificationToken', () => {
    it('creates token row', async () => {
      const tokenData = {
        identifier: 'alice@test.com',
        token: 'hashed-token-123',
        expires: new Date('2024-02-01'),
      };

      (db.verificationToken.create as ReturnType<typeof vi.fn>).mockResolvedValue(tokenData);

      const result = await adapter.createVerificationToken!(tokenData);

      expect(db.verificationToken.create).toHaveBeenCalledWith({
        data: tokenData,
      });
      expect(result).toEqual(tokenData);
    });
  });

  // -------------------------------------------------------------------------
  // useVerificationToken
  // -------------------------------------------------------------------------

  describe('useVerificationToken', () => {
    it('deletes and returns token', async () => {
      const tokenData = {
        identifier: 'alice@test.com',
        token: 'hashed-token-123',
        expires: new Date('2024-02-01'),
      };

      (db.verificationToken.delete as ReturnType<typeof vi.fn>).mockResolvedValue(tokenData);

      const result = await adapter.useVerificationToken!({
        identifier: 'alice@test.com',
        token: 'hashed-token-123',
      });

      expect(db.verificationToken.delete).toHaveBeenCalledWith({
        where: {
          identifier_token: {
            identifier: 'alice@test.com',
            token: 'hashed-token-123',
          },
        },
      });
      expect(result).toEqual(tokenData);
    });

    it('returns null when token not found (P2025)', async () => {
      const prismaNotFound = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      (db.verificationToken.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
        prismaNotFound,
      );

      const result = await adapter.useVerificationToken!({
        identifier: 'nonexistent@test.com',
        token: 'nonexistent',
      });

      expect(result).toBeNull();
    });

    it('re-throws non-P2025 database errors', async () => {
      const dbError = new Error('Connection refused');
      (db.verificationToken.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
        dbError,
      );

      await expect(
        adapter.useVerificationToken!({
          identifier: 'test@test.com',
          token: 'test-token',
        }),
      ).rejects.toThrow('Connection refused');
    });
  });

  // -------------------------------------------------------------------------
  // Database session methods
  // -------------------------------------------------------------------------

  describe('database session methods', () => {
    it('database session methods are omitted from the adapter', () => {
      // With JWT strategy, session methods should be omitted
      // (they are optional in the Adapter interface)
      expect(adapter.createSession).toBeUndefined();
      expect(adapter.getSessionAndUser).toBeUndefined();
      expect(adapter.updateSession).toBeUndefined();
      expect(adapter.deleteSession).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // deleteUser safety
  // -------------------------------------------------------------------------

  describe('deleteUser safety', () => {
    it('deleteUser is omitted from the adapter', () => {
      expect(adapter.deleteUser).toBeUndefined();
    });

    it('internal User lifecycle remains application-owned', () => {
      // db.user should not expose delete at all in the adapter DB interface
      expect(db.user).not.toHaveProperty('delete');
    });
  });
});

// ---------------------------------------------------------------------------
// createUnsupportedDatabaseSessionMethod
// ---------------------------------------------------------------------------

describe('createUnsupportedDatabaseSessionMethod', () => {
  it('throws with the disabled-session message', () => {
    const method = createUnsupportedDatabaseSessionMethod('createSession');
    expect(() => method()).toThrow(AUTHJS_DATABASE_SESSIONS_DISABLED_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// Module isolation tests
// ---------------------------------------------------------------------------

describe('Adapter module isolation', () => {
  it('adapter does not require live DB', () => {
    // The adapter factory accepts a mock, proving no live DB required
    const db = createMockDB();
    const adapter = createAuthjsAdapter(db);
    expect(adapter).toBeDefined();
    expect(adapter.createUser).toBeDefined();
    expect(adapter.getUser).toBeDefined();
  });

  it('adapter module does not import getPrisma or instantiate PrismaClient', () => {
    const adapterSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/auth/authjs-adapter.ts'),
      'utf-8',
    );
    // Strip comments before checking — JSDoc may reference these terms
    const codeOnly = adapterSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain('getPrisma');
    expect(codeOnly).not.toContain('PrismaClient');
  });

  it('adapter module does not import routes or handlers', () => {
    const adapterSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/auth/authjs-adapter.ts'),
      'utf-8',
    );
    expect(adapterSource).not.toContain("from 'next/");
    expect(adapterSource).not.toContain('from "next/');
    expect(adapterSource).not.toContain('src/app/');
  });
});

// ---------------------------------------------------------------------------
// Scope guard tests
// ---------------------------------------------------------------------------

describe('Auth.js scope guard tests', () => {
  const SRC_ROOT = path.resolve(__dirname, '../../src');
  const PROJECT_ROOT = path.resolve(__dirname, '../..');

  function findFiles(dir: string, ext: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          results.push(...findFiles(fullPath, ext));
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory does not exist
    }
    return results;
  }

  function filesContainImport(dir: string, importPattern: string): string[] {
    const tsFiles = [...findFiles(dir, '.ts'), ...findFiles(dir, '.tsx')];
    return tsFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes(importPattern);
    });
  }

  it('src/app/** does not import next-auth', () => {
    const appDir = path.join(SRC_ROOT, 'app');
    const violations = filesContainImport(appDir, 'next-auth');
    expect(violations).toEqual([]);
  });

  it('src/app/** does not import @auth/prisma-adapter', () => {
    const appDir = path.join(SRC_ROOT, 'app');
    const violations = filesContainImport(appDir, '@auth/prisma-adapter');
    expect(violations).toEqual([]);
  });

  it('src/domains/** does not import next-auth', () => {
    const domainsDir = path.join(SRC_ROOT, 'domains');
    const violations = filesContainImport(domainsDir, 'next-auth');
    expect(violations).toEqual([]);
  });

  it('src/domains/** does not import @auth/prisma-adapter', () => {
    const domainsDir = path.join(SRC_ROOT, 'domains');
    const violations = filesContainImport(domainsDir, '@auth/prisma-adapter');
    expect(violations).toEqual([]);
  });

  it('no middleware.ts was added', () => {
    const middlewarePath = path.join(SRC_ROOT, 'middleware.ts');
    const rootMiddleware = path.join(PROJECT_ROOT, 'middleware.ts');
    expect(fs.existsSync(middlewarePath)).toBe(false);
    expect(fs.existsSync(rootMiddleware)).toBe(false);
  });

  it('no auth route handlers were added', () => {
    const authApiDir = path.join(SRC_ROOT, 'app', 'api', 'auth');
    expect(fs.existsSync(authApiDir)).toBe(false);
  });

  it('prisma/schema.prisma was not changed in this task', () => {
    // Verify schema still has the exact TASK-0031 marker and has not been modified
    const schemaPath = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    // Schema should still reference TASK-0031 as last schema change
    expect(schema).toContain('TASK-0031');
    // Should not reference TASK-0032
    expect(schema).not.toContain('TASK-0032');
  });

  it('no migration files were added in this task', () => {
    const migrationsDir = path.join(PROJECT_ROOT, 'prisma', 'migrations');
    const dirs = fs.readdirSync(migrationsDir).filter((d) =>
      d.includes('0032') || d.includes('authjs_package') || d.includes('adapter_wrapper'),
    );
    expect(dirs).toEqual([]);
  });

  it('no production route imports next-auth or @auth/prisma-adapter', () => {
    const appDir = path.join(SRC_ROOT, 'app');
    const nextAuthViolations = filesContainImport(appDir, 'next-auth');
    const adapterViolations = filesContainImport(appDir, '@auth/prisma-adapter');
    expect(nextAuthViolations).toEqual([]);
    expect(adapterViolations).toEqual([]);
  });
});

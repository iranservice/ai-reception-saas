import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Mock NextAuth before importing route handlers
// ---------------------------------------------------------------------------

const mockHandlers = {
  GET: vi.fn(async () => new Response('auth-get')),
  POST: vi.fn(async () => new Response('auth-post')),
};

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: mockHandlers,
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

import {
  createAuthjsRouteHandlers,
  createDisabledAuthjsRouteResponse,
  AUTHJS_ROUTE_DISABLED_CODE,
  AUTHJS_ROUTE_DISABLED_MESSAGE,
  AUTHJS_ROUTE_DISABLED_STATUS,
  type AuthjsRouteHandlerInput,
} from '../../src/lib/auth/authjs-route-handlers';
import {
  createAuthjsAdapterDb,
  type AuthjsPrismaClient,
} from '../../src/lib/auth/authjs-prisma-db';
import { AUTHJS_RUNTIME_FEATURE_FLAG } from '../../src/lib/auth/authjs-feature-gate';
import type { AuthjsAdapterDB } from '../../src/lib/auth/authjs-adapter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPrisma(): AuthjsPrismaClient {
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

function validInput(overrides?: Partial<AuthjsRouteHandlerInput>): AuthjsRouteHandlerInput {
  return {
    prisma: createMockPrisma(),
    authSecret: 'test-secret-for-auth-route-handlers',
    providers: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prisma DB bridge tests
// ---------------------------------------------------------------------------

describe('createAuthjsAdapterDb', () => {
  it('returns an AuthjsAdapterDB from a Prisma-like client', () => {
    const prisma = createMockPrisma();
    const db = createAuthjsAdapterDb(prisma);

    expect(db.user).toBe(prisma.user);
    expect(db.account).toBe(prisma.account);
    expect(db.verificationToken).toBe(prisma.verificationToken);
  });

  it('does not expose business or other internal models', () => {
    const prisma = createMockPrisma();
    const db: AuthjsAdapterDB = createAuthjsAdapterDb(prisma);
    const dbKeys = Object.keys(db);

    expect(dbKeys).toContain('user');
    expect(dbKeys).toContain('account');
    expect(dbKeys).toContain('verificationToken');
    expect(dbKeys).not.toContain('business');
    expect(dbKeys).not.toContain('businessMembership');
    expect(dbKeys).not.toContain('auditEvent');
    expect(dbKeys).not.toContain('session');
  });
});

// ---------------------------------------------------------------------------
// Route handler factory — disabled state
// ---------------------------------------------------------------------------

describe('createAuthjsRouteHandlers — disabled', () => {
  const originalEnv = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];

  beforeEach(() => {
    delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = originalEnv;
    }
  });

  it('returns enabled: false when feature flag is off', () => {
    const result = createAuthjsRouteHandlers(validInput());
    expect(result.enabled).toBe(false);
  });

  it('GET returns 501 with structured error body', async () => {
    const { GET } = createAuthjsRouteHandlers(validInput());
    const response = await GET(new Request('http://localhost/api/auth/session') as never);
    expect(response.status).toBe(AUTHJS_ROUTE_DISABLED_STATUS);
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe(AUTHJS_ROUTE_DISABLED_CODE);
    expect(body.error.message).toBe(AUTHJS_ROUTE_DISABLED_MESSAGE);
  });

  it('POST returns 501 with structured error body', async () => {
    const { POST } = createAuthjsRouteHandlers(validInput());
    const response = await POST(new Request('http://localhost/api/auth/signin', { method: 'POST' }) as never);
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AUTHJS_RUNTIME_DISABLED');
    expect(body.error.message).toBe(AUTHJS_ROUTE_DISABLED_MESSAGE);
  });

  it('does not initialize NextAuth when disabled', async () => {
    const { default: NextAuth } = await import('next-auth');
    const mockedNextAuth = vi.mocked(NextAuth);
    const callsBefore = mockedNextAuth.mock.calls.length;
    createAuthjsRouteHandlers(validInput());
    expect(mockedNextAuth.mock.calls.length).toBe(callsBefore);
  });

  it('disabled for "TRUE" (strict flag)', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'TRUE';
    const result = createAuthjsRouteHandlers(validInput());
    expect(result.enabled).toBe(false);
  });

  it('disabled for "1" (strict flag)', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = '1';
    const result = createAuthjsRouteHandlers(validInput());
    expect(result.enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDisabledAuthjsRouteResponse (shared helper)
// ---------------------------------------------------------------------------

describe('createDisabledAuthjsRouteResponse', () => {
  it('returns 501 status', () => {
    const response = createDisabledAuthjsRouteResponse();
    expect(response.status).toBe(501);
  });

  it('returns structured error body', async () => {
    const response = createDisabledAuthjsRouteResponse();
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      error: {
        code: 'AUTHJS_RUNTIME_DISABLED',
        message: 'Auth.js runtime is disabled.',
      },
    });
  });

  it('returns application/json content-type', () => {
    const response = createDisabledAuthjsRouteResponse();
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Route handler factory — enabled state
// ---------------------------------------------------------------------------

describe('createAuthjsRouteHandlers — enabled', () => {
  const originalEnv = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];

  beforeEach(() => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = originalEnv;
    } else {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
  });

  it('returns enabled: true when feature flag is on', () => {
    const result = createAuthjsRouteHandlers(validInput());
    expect(result.enabled).toBe(true);
  });

  it('throws if AUTH_SECRET is empty', () => {
    expect(() =>
      createAuthjsRouteHandlers(validInput({ authSecret: '' })),
    ).toThrow(/AUTH_SECRET/);
  });

  it('throws if AUTH_SECRET is whitespace-only', () => {
    expect(() =>
      createAuthjsRouteHandlers(validInput({ authSecret: '   ' })),
    ).toThrow(/AUTH_SECRET/);
  });

  it('initializes NextAuth with correct config', async () => {
    const { default: NextAuth } = await import('next-auth');
    const mockedNextAuth = vi.mocked(NextAuth);
    mockedNextAuth.mockClear();

    createAuthjsRouteHandlers(validInput({
      authSecret: 'my-secret',
      providers: [{ id: 'test', type: 'oauth' }],
      basePath: '/api/auth',
      debug: true,
    }));

    expect(mockedNextAuth).toHaveBeenCalledTimes(1);
    const config = mockedNextAuth.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(config.session).toEqual({ strategy: 'jwt' });
    expect(config.secret).toBe('my-secret');
    expect(config.basePath).toBe('/api/auth');
    expect(config.debug).toBe(true);
    expect(config.adapter).toBeDefined();
    expect(config.providers).toEqual([{ id: 'test', type: 'oauth' }]);
  });

  it('defaults debug to false', async () => {
    const { default: NextAuth } = await import('next-auth');
    const mockedNextAuth = vi.mocked(NextAuth);
    mockedNextAuth.mockClear();

    createAuthjsRouteHandlers(validInput());

    const config = mockedNextAuth.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(config.debug).toBe(false);
  });

  it('defaults providers to empty array', async () => {
    const { default: NextAuth } = await import('next-auth');
    const mockedNextAuth = vi.mocked(NextAuth);
    mockedNextAuth.mockClear();

    createAuthjsRouteHandlers(validInput({ providers: undefined }));

    const config = mockedNextAuth.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(config.providers).toEqual([]);
  });

  it('returns real NextAuth GET handler', () => {
    const result = createAuthjsRouteHandlers(validInput());
    expect(result.GET).toBe(mockHandlers.GET);
  });

  it('returns real NextAuth POST handler', () => {
    const result = createAuthjsRouteHandlers(validInput());
    expect(result.POST).toBe(mockHandlers.POST);
  });
});

// ---------------------------------------------------------------------------
// Scope guard tests
// ---------------------------------------------------------------------------

describe('TASK-0034 scope guard tests', () => {
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

  it('no middleware.ts was added', () => {
    expect(fs.existsSync(path.join(SRC_ROOT, 'middleware.ts'))).toBe(false);
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'middleware.ts'))).toBe(false);
  });

  it('auth route handler exists at correct path', () => {
    expect(
      fs.existsSync(
        path.join(SRC_ROOT, 'app', 'api', 'auth', '[...nextauth]', 'route.ts'),
      ),
    ).toBe(true);
  });

  it('auth route handler does not import request-context resolver', () => {
    const routeSource = fs.readFileSync(
      path.join(SRC_ROOT, 'app', 'api', 'auth', '[...nextauth]', 'route.ts'),
      'utf-8',
    );
    expect(routeSource).not.toContain('resolveRequestContext');
    expect(routeSource).not.toContain('RequestContext');
  });

  it('existing tenant/identity API routes were not modified', () => {
    // Verify no import of authjs-route-handlers in existing domains routes
    const appApiDir = path.join(SRC_ROOT, 'app', 'api');
    const tsFiles = findFiles(appApiDir, '.ts');
    const nonAuthFiles = tsFiles.filter(
      (f) => !f.includes('[...nextauth]'),
    );
    for (const file of nonAuthFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('authjs-route-handlers');
    }
  });

  it('src/domains/** does not import route handlers', () => {
    const domainsDir = path.join(SRC_ROOT, 'domains');
    const tsFiles = [...findFiles(domainsDir, '.ts'), ...findFiles(domainsDir, '.tsx')];
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('authjs-route-handlers');
    }
  });

  it('prisma/schema.prisma was not changed', () => {
    const schema = fs.readFileSync(
      path.join(PROJECT_ROOT, 'prisma', 'schema.prisma'),
      'utf-8',
    );
    expect(schema).toContain('TASK-0031');
    expect(schema).not.toContain('TASK-0034');
  });

  it('no migration files were added', () => {
    const migrationsDir = path.join(PROJECT_ROOT, 'prisma', 'migrations');
    const dirs = fs.readdirSync(migrationsDir).filter(
      (d) => d.includes('0034'),
    );
    expect(dirs).toEqual([]);
  });

  it('route handler module does not import getPrisma directly', () => {
    const source = fs.readFileSync(
      path.resolve(SRC_ROOT, 'lib/auth/authjs-route-handlers.ts'),
      'utf-8',
    );
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain('getPrisma');
  });

  it('prisma-db bridge does not import @prisma/client or getPrisma', () => {
    const source = fs.readFileSync(
      path.resolve(SRC_ROOT, 'lib/auth/authjs-prisma-db.ts'),
      'utf-8',
    );
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain("from '@prisma/client'");
    expect(codeOnly).not.toContain('from "@prisma/client"');
    expect(codeOnly).not.toContain('getPrisma');
  });
});

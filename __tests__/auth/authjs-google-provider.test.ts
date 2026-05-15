import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Mock Google provider before importing module under test
// ---------------------------------------------------------------------------

const { mockGoogleProvider } = vi.hoisted(() => {
  const mockGoogleProvider = vi.fn(
    (opts: { clientId: string; clientSecret: string }) => ({
      id: 'google',
      name: 'Google',
      type: 'oidc',
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
    }),
  );
  return { mockGoogleProvider };
});

vi.mock('next-auth/providers/google', () => ({
  default: mockGoogleProvider,
}));

import {
  AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG,
  AUTHJS_GOOGLE_PROVIDER_ID,
  AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE,
  AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE,
  isAuthjsGoogleProviderEnabled,
  validateGoogleProviderCredentials,
  createGoogleAuthProvider,
  createAuthjsProviders,
  type GoogleProviderCredentials,
  type GoogleProviderEnv,
} from '../../src/lib/auth/authjs-google-provider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Google provider constants', () => {
  it('AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG is ENABLE_AUTHJS_GOOGLE_PROVIDER', () => {
    expect(AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG).toBe(
      'ENABLE_AUTHJS_GOOGLE_PROVIDER',
    );
  });

  it('AUTHJS_GOOGLE_PROVIDER_ID is google', () => {
    expect(AUTHJS_GOOGLE_PROVIDER_ID).toBe('google');
  });

  it('AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE mentions ENABLE_AUTHJS_GOOGLE_PROVIDER', () => {
    expect(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE).toContain(
      'ENABLE_AUTHJS_GOOGLE_PROVIDER',
    );
    expect(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE).toContain(
      'AUTH_GOOGLE_ID',
    );
  });

  it('AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE mentions ENABLE_AUTHJS_GOOGLE_PROVIDER', () => {
    expect(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE).toContain(
      'ENABLE_AUTHJS_GOOGLE_PROVIDER',
    );
    expect(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE).toContain(
      'AUTH_GOOGLE_SECRET',
    );
  });
});

// ---------------------------------------------------------------------------
// Feature flag: isAuthjsGoogleProviderEnabled
// ---------------------------------------------------------------------------

describe('isAuthjsGoogleProviderEnabled', () => {
  it('returns true for exact "true"', () => {
    expect(
      isAuthjsGoogleProviderEnabled({ ENABLE_AUTHJS_GOOGLE_PROVIDER: 'true' }),
    ).toBe(true);
  });

  it('returns false for "TRUE" (case-sensitive)', () => {
    expect(
      isAuthjsGoogleProviderEnabled({ ENABLE_AUTHJS_GOOGLE_PROVIDER: 'TRUE' }),
    ).toBe(false);
  });

  it('returns false for "True" (case-sensitive)', () => {
    expect(
      isAuthjsGoogleProviderEnabled({ ENABLE_AUTHJS_GOOGLE_PROVIDER: 'True' }),
    ).toBe(false);
  });

  it('returns false for "1" (no numeric truthy)', () => {
    expect(
      isAuthjsGoogleProviderEnabled({ ENABLE_AUTHJS_GOOGLE_PROVIDER: '1' }),
    ).toBe(false);
  });

  it('returns false for "yes"', () => {
    expect(
      isAuthjsGoogleProviderEnabled({ ENABLE_AUTHJS_GOOGLE_PROVIDER: 'yes' }),
    ).toBe(false);
  });

  it('returns false for " true " (no trimming)', () => {
    expect(
      isAuthjsGoogleProviderEnabled({
        ENABLE_AUTHJS_GOOGLE_PROVIDER: ' true ',
      }),
    ).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(
      isAuthjsGoogleProviderEnabled({ ENABLE_AUTHJS_GOOGLE_PROVIDER: '' }),
    ).toBe(false);
  });

  it('returns false when not set (undefined)', () => {
    expect(isAuthjsGoogleProviderEnabled({})).toBe(false);
  });

  it('returns false when undefined value', () => {
    expect(
      isAuthjsGoogleProviderEnabled({
        ENABLE_AUTHJS_GOOGLE_PROVIDER: undefined,
      }),
    ).toBe(false);
  });

  it('defaults to process.env when no argument', () => {
    const original = process.env.ENABLE_AUTHJS_GOOGLE_PROVIDER;
    try {
      delete process.env.ENABLE_AUTHJS_GOOGLE_PROVIDER;
      expect(isAuthjsGoogleProviderEnabled()).toBe(false);

      process.env.ENABLE_AUTHJS_GOOGLE_PROVIDER = 'true';
      expect(isAuthjsGoogleProviderEnabled()).toBe(true);
    } finally {
      if (original !== undefined) {
        process.env.ENABLE_AUTHJS_GOOGLE_PROVIDER = original;
      } else {
        delete process.env.ENABLE_AUTHJS_GOOGLE_PROVIDER;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Credential validation: validateGoogleProviderCredentials
// ---------------------------------------------------------------------------

describe('validateGoogleProviderCredentials', () => {
  it('returns trimmed credentials when both are present', () => {
    const result = validateGoogleProviderCredentials({
      AUTH_GOOGLE_ID: '  my-client-id.apps.googleusercontent.com  ',
      AUTH_GOOGLE_SECRET: '  my-secret  ',
    });
    expect(result.clientId).toBe(
      'my-client-id.apps.googleusercontent.com',
    );
    expect(result.clientSecret).toBe('my-secret');
  });

  it('returns credentials without trimming when no whitespace', () => {
    const result = validateGoogleProviderCredentials({
      AUTH_GOOGLE_ID: 'client-id',
      AUTH_GOOGLE_SECRET: 'client-secret',
    });
    expect(result).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
  });

  it('throws when AUTH_GOOGLE_ID is missing', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_SECRET: 'secret',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE);
  });

  it('throws when AUTH_GOOGLE_ID is empty string', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_ID: '',
        AUTH_GOOGLE_SECRET: 'secret',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE);
  });

  it('throws when AUTH_GOOGLE_ID is whitespace-only', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_ID: '   ',
        AUTH_GOOGLE_SECRET: 'secret',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE);
  });

  it('throws when AUTH_GOOGLE_ID is undefined', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_ID: undefined,
        AUTH_GOOGLE_SECRET: 'secret',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE);
  });

  it('throws when AUTH_GOOGLE_SECRET is missing', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_ID: 'id',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE);
  });

  it('throws when AUTH_GOOGLE_SECRET is empty string', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_ID: 'id',
        AUTH_GOOGLE_SECRET: '',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE);
  });

  it('throws when AUTH_GOOGLE_SECRET is whitespace-only', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_ID: 'id',
        AUTH_GOOGLE_SECRET: '   ',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE);
  });

  it('throws when AUTH_GOOGLE_SECRET is undefined', () => {
    expect(() =>
      validateGoogleProviderCredentials({
        AUTH_GOOGLE_ID: 'id',
        AUTH_GOOGLE_SECRET: undefined,
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE);
  });

  it('checks AUTH_GOOGLE_ID before AUTH_GOOGLE_SECRET', () => {
    expect(() =>
      validateGoogleProviderCredentials({}),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE);
  });

  it('defaults to process.env when no argument', () => {
    const origId = process.env.AUTH_GOOGLE_ID;
    const origSecret = process.env.AUTH_GOOGLE_SECRET;
    try {
      process.env.AUTH_GOOGLE_ID = 'env-id';
      process.env.AUTH_GOOGLE_SECRET = 'env-secret';
      const result = validateGoogleProviderCredentials();
      expect(result.clientId).toBe('env-id');
      expect(result.clientSecret).toBe('env-secret');
    } finally {
      if (origId !== undefined) process.env.AUTH_GOOGLE_ID = origId;
      else delete process.env.AUTH_GOOGLE_ID;
      if (origSecret !== undefined) process.env.AUTH_GOOGLE_SECRET = origSecret;
      else delete process.env.AUTH_GOOGLE_SECRET;
    }
  });
});

// ---------------------------------------------------------------------------
// Provider factory: createGoogleAuthProvider
// ---------------------------------------------------------------------------

describe('createGoogleAuthProvider', () => {
  beforeEach(() => {
    mockGoogleProvider.mockClear();
  });

  it('calls Google provider with clientId and clientSecret', () => {
    const credentials: GoogleProviderCredentials = {
      clientId: 'test-id',
      clientSecret: 'test-secret',
    };
    createGoogleAuthProvider(credentials);

    expect(mockGoogleProvider).toHaveBeenCalledTimes(1);
    expect(mockGoogleProvider).toHaveBeenCalledWith({
      clientId: 'test-id',
      clientSecret: 'test-secret',
    });
  });

  it('returns the provider config object from Google()', () => {
    const credentials: GoogleProviderCredentials = {
      clientId: 'my-id',
      clientSecret: 'my-secret',
    };
    const result = createGoogleAuthProvider(credentials);

    expect(result).toEqual({
      id: 'google',
      name: 'Google',
      type: 'oidc',
      clientId: 'my-id',
      clientSecret: 'my-secret',
    });
  });
});

// ---------------------------------------------------------------------------
// Providers array builder: createAuthjsProviders
// ---------------------------------------------------------------------------

describe('createAuthjsProviders', () => {
  beforeEach(() => {
    mockGoogleProvider.mockClear();
  });

  it('returns empty array when Google provider flag is disabled', () => {
    const result = createAuthjsProviders({});
    expect(result).toEqual([]);
    expect(mockGoogleProvider).not.toHaveBeenCalled();
  });

  it('returns empty array when Google provider flag is "TRUE" (strict)', () => {
    const result = createAuthjsProviders({
      ENABLE_AUTHJS_GOOGLE_PROVIDER: 'TRUE',
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when Google provider flag is "1" (strict)', () => {
    const result = createAuthjsProviders({
      ENABLE_AUTHJS_GOOGLE_PROVIDER: '1',
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when Google provider flag is " true " (no trim)', () => {
    const result = createAuthjsProviders({
      ENABLE_AUTHJS_GOOGLE_PROVIDER: ' true ',
    });
    expect(result).toEqual([]);
  });

  it('returns Google provider when flag is enabled and credentials are valid', () => {
    const result = createAuthjsProviders({
      ENABLE_AUTHJS_GOOGLE_PROVIDER: 'true',
      AUTH_GOOGLE_ID: 'id',
      AUTH_GOOGLE_SECRET: 'secret',
    });

    expect(result).toHaveLength(1);
    expect(mockGoogleProvider).toHaveBeenCalledWith({
      clientId: 'id',
      clientSecret: 'secret',
    });
  });

  it('throws when flag is enabled but AUTH_GOOGLE_ID is missing', () => {
    expect(() =>
      createAuthjsProviders({
        ENABLE_AUTHJS_GOOGLE_PROVIDER: 'true',
        AUTH_GOOGLE_SECRET: 'secret',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE);
  });

  it('throws when flag is enabled but AUTH_GOOGLE_SECRET is missing', () => {
    expect(() =>
      createAuthjsProviders({
        ENABLE_AUTHJS_GOOGLE_PROVIDER: 'true',
        AUTH_GOOGLE_ID: 'id',
      }),
    ).toThrow(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE);
  });

  it('does not validate credentials when flag is disabled', () => {
    // This should NOT throw even though credentials are missing
    const result = createAuthjsProviders({
      ENABLE_AUTHJS_GOOGLE_PROVIDER: 'false',
    });
    expect(result).toEqual([]);
  });

  it('does not validate credentials when flag is not set', () => {
    const result = createAuthjsProviders({});
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('GoogleProviderCredentials shape is correct', () => {
    const creds: GoogleProviderCredentials = {
      clientId: 'id',
      clientSecret: 'secret',
    };
    expect(creds.clientId).toBe('id');
    expect(creds.clientSecret).toBe('secret');
  });

  it('GoogleProviderEnv shape accepts optional fields', () => {
    const env1: GoogleProviderEnv = {};
    const env2: GoogleProviderEnv = {
      ENABLE_AUTHJS_GOOGLE_PROVIDER: 'true',
      AUTH_GOOGLE_ID: 'id',
      AUTH_GOOGLE_SECRET: 'secret',
    };
    expect(env1).toBeDefined();
    expect(env2).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Module isolation and scope guards
// ---------------------------------------------------------------------------

describe('TASK-0036 scope guard tests', () => {
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

  it('authjs-google-provider.ts exists', () => {
    expect(
      fs.existsSync(
        path.join(SRC_ROOT, 'lib', 'auth', 'authjs-google-provider.ts'),
      ),
    ).toBe(true);
  });

  it('authjs-google-provider.ts imports from next-auth/providers/google', () => {
    const source = fs.readFileSync(
      path.join(SRC_ROOT, 'lib', 'auth', 'authjs-google-provider.ts'),
      'utf-8',
    );
    expect(source).toContain("from 'next-auth/providers/google'");
  });

  it('authjs-google-provider.ts does not import getPrisma', () => {
    const source = fs.readFileSync(
      path.join(SRC_ROOT, 'lib', 'auth', 'authjs-google-provider.ts'),
      'utf-8',
    );
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain('getPrisma');
  });

  it('authjs-google-provider.ts does not import PrismaClient', () => {
    const source = fs.readFileSync(
      path.join(SRC_ROOT, 'lib', 'auth', 'authjs-google-provider.ts'),
      'utf-8',
    );
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain('PrismaClient');
  });

  it('authjs-google-provider.ts does not import route handlers', () => {
    const source = fs.readFileSync(
      path.join(SRC_ROOT, 'lib', 'auth', 'authjs-google-provider.ts'),
      'utf-8',
    );
    expect(source).not.toContain('authjs-route-handlers');
  });

  it('route handler imports createAuthjsProviders', () => {
    const source = fs.readFileSync(
      path.join(
        SRC_ROOT,
        'app',
        'api',
        'auth',
        '[...nextauth]',
        'route.ts',
      ),
      'utf-8',
    );
    expect(source).toContain('createAuthjsProviders');
    expect(source).toContain('authjs-google-provider');
  });

  it('route handler passes createAuthjsProviders() to providers', () => {
    const source = fs.readFileSync(
      path.join(
        SRC_ROOT,
        'app',
        'api',
        'auth',
        '[...nextauth]',
        'route.ts',
      ),
      'utf-8',
    );
    expect(source).toContain('providers: createAuthjsProviders()');
  });

  it('route handler does not hardcode providers: []', () => {
    const source = fs.readFileSync(
      path.join(
        SRC_ROOT,
        'app',
        'api',
        'auth',
        '[...nextauth]',
        'route.ts',
      ),
      'utf-8',
    );
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toMatch(/providers:\s*\[\s*\]/);
  });

  it('auth barrel index.ts re-exports Google provider module', () => {
    const source = fs.readFileSync(
      path.join(SRC_ROOT, 'lib', 'auth', 'index.ts'),
      'utf-8',
    );
    expect(source).toContain('authjs-google-provider');
    expect(source).toContain('AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG');
    expect(source).toContain('isAuthjsGoogleProviderEnabled');
    expect(source).toContain('createAuthjsProviders');
  });

  it('src/domains/** does not import google provider module', () => {
    const domainsDir = path.join(SRC_ROOT, 'domains');
    const tsFiles = [
      ...findFiles(domainsDir, '.ts'),
      ...findFiles(domainsDir, '.tsx'),
    ];
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('authjs-google-provider');
      expect(content).not.toContain('ENABLE_AUTHJS_GOOGLE_PROVIDER');
    }
  });

  it('no middleware.ts was added', () => {
    expect(fs.existsSync(path.join(SRC_ROOT, 'middleware.ts'))).toBe(false);
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'middleware.ts'))).toBe(
      false,
    );
  });

  it('prisma/schema.prisma was not changed (no TASK-0036 marker)', () => {
    const schema = fs.readFileSync(
      path.join(PROJECT_ROOT, 'prisma', 'schema.prisma'),
      'utf-8',
    );
    expect(schema).not.toContain('TASK-0036');
  });

  it('no migration files were added for TASK-0036', () => {
    const migrationsDir = path.join(PROJECT_ROOT, 'prisma', 'migrations');
    const dirs = fs
      .readdirSync(migrationsDir)
      .filter((d) => d.includes('0036'));
    expect(dirs).toEqual([]);
  });

  it('package.json was not changed (no new dependencies)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'),
    );
    // Verify the specific packages from TASK-0032 still exist and no new auth packages
    expect(pkg.dependencies['next-auth']).toBe('5.0.0-beta.31');
    expect(pkg.dependencies['@auth/prisma-adapter']).toBeDefined();
    // No new provider package
    expect(pkg.dependencies['@auth/google']).toBeUndefined();
    expect(pkg.dependencies['next-auth-google']).toBeUndefined();
  });
});

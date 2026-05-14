import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AUTHJS_RUNTIME_FEATURE_FLAG,
  isAuthjsRuntimeEnabled,
  assertAuthjsRuntimeEnabled,
  AuthjsRuntimeDisabledError,
} from '../../src/lib/auth/authjs-feature-gate';
import {
  createAuthjsConfig,
  tryCreateAuthjsConfig,
  validateAuthjsSecret,
  validateProviders,
  normalizeProviderDescriptor,
  AUTHJS_SESSION_STRATEGY,
  AUTHJS_MISSING_SECRET_MESSAGE,
  type AuthjsConfigInput,
} from '../../src/lib/auth/authjs-runtime-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAdapter() {
  return {
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    updateUser: vi.fn(),
  } as never;
}

function validConfigInput(overrides?: Partial<AuthjsConfigInput>): AuthjsConfigInput {
  return {
    adapter: mockAdapter(),
    providers: [],
    secrets: { authSecret: 'test-secret-at-least-32-chars-long!!' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Feature gate tests
// ---------------------------------------------------------------------------

describe('authjs-feature-gate', () => {
  const originalEnv = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    } else {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = originalEnv;
    }
  });

  describe('AUTHJS_RUNTIME_FEATURE_FLAG', () => {
    it('equals ENABLE_AUTHJS_RUNTIME', () => {
      expect(AUTHJS_RUNTIME_FEATURE_FLAG).toBe('ENABLE_AUTHJS_RUNTIME');
    });
  });

  describe('isAuthjsRuntimeEnabled', () => {
    it('returns false when env var is undefined', () => {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
      expect(isAuthjsRuntimeEnabled()).toBe(false);
    });

    it('returns false when env var is empty', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = '';
      expect(isAuthjsRuntimeEnabled()).toBe(false);
    });

    it('returns false when env var is "false"', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'false';
      expect(isAuthjsRuntimeEnabled()).toBe(false);
    });

    it('returns false when env var is "0"', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = '0';
      expect(isAuthjsRuntimeEnabled()).toBe(false);
    });

    it('returns false when env var is arbitrary string', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'maybe';
      expect(isAuthjsRuntimeEnabled()).toBe(false);
    });

    it('returns true when env var is "true"', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
      expect(isAuthjsRuntimeEnabled()).toBe(true);
    });

    it('returns true when env var is "TRUE"', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'TRUE';
      expect(isAuthjsRuntimeEnabled()).toBe(true);
    });

    it('returns true when env var is "True" with whitespace', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = '  True  ';
      expect(isAuthjsRuntimeEnabled()).toBe(true);
    });

    it('returns true when env var is "1"', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = '1';
      expect(isAuthjsRuntimeEnabled()).toBe(true);
    });
  });

  describe('assertAuthjsRuntimeEnabled', () => {
    it('throws AuthjsRuntimeDisabledError when disabled', () => {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
      expect(() => assertAuthjsRuntimeEnabled('testOp')).toThrow(
        AuthjsRuntimeDisabledError,
      );
    });

    it('includes operation name in error message', () => {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
      expect(() => assertAuthjsRuntimeEnabled('createAuthjsConfig')).toThrow(
        /createAuthjsConfig/,
      );
    });

    it('includes feature flag name in error message', () => {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
      expect(() => assertAuthjsRuntimeEnabled('test')).toThrow(
        /ENABLE_AUTHJS_RUNTIME/,
      );
    });

    it('does not throw when enabled', () => {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
      expect(() => assertAuthjsRuntimeEnabled('testOp')).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Secret validation
// ---------------------------------------------------------------------------

describe('validateAuthjsSecret', () => {
  it('returns trimmed secret for valid input', () => {
    expect(validateAuthjsSecret('  my-secret  ')).toBe('my-secret');
  });

  it('throws for undefined secret', () => {
    expect(() => validateAuthjsSecret(undefined)).toThrow(
      AUTHJS_MISSING_SECRET_MESSAGE,
    );
  });

  it('throws for null secret', () => {
    expect(() => validateAuthjsSecret(null)).toThrow(
      AUTHJS_MISSING_SECRET_MESSAGE,
    );
  });

  it('throws for empty secret', () => {
    expect(() => validateAuthjsSecret('')).toThrow(
      AUTHJS_MISSING_SECRET_MESSAGE,
    );
  });

  it('throws for whitespace-only secret', () => {
    expect(() => validateAuthjsSecret('   ')).toThrow(
      AUTHJS_MISSING_SECRET_MESSAGE,
    );
  });
});

// ---------------------------------------------------------------------------
// Provider normalization
// ---------------------------------------------------------------------------

describe('normalizeProviderDescriptor', () => {
  it('normalizes valid oauth provider', () => {
    const result = normalizeProviderDescriptor({
      id: 'google',
      name: 'Google',
      type: 'oauth',
    });
    expect(result).toEqual({
      id: 'google',
      name: 'Google',
      type: 'oauth',
    });
  });

  it('normalizes valid oidc provider', () => {
    const result = normalizeProviderDescriptor({
      id: 'azure-ad',
      name: 'Azure AD',
      type: 'oidc',
    });
    expect(result).toEqual({
      id: 'azure-ad',
      name: 'Azure AD',
      type: 'oidc',
    });
  });

  it('normalizes valid email provider', () => {
    const result = normalizeProviderDescriptor({
      id: 'email',
      name: 'Magic Link',
      type: 'email',
    });
    expect(result).toEqual({
      id: 'email',
      name: 'Magic Link',
      type: 'email',
    });
  });

  it('normalizes valid credentials provider', () => {
    const result = normalizeProviderDescriptor({
      id: 'credentials',
      name: 'Password',
      type: 'credentials',
    });
    expect(result).toEqual({
      id: 'credentials',
      name: 'Password',
      type: 'credentials',
    });
  });

  it('uses id as name when name is missing', () => {
    const result = normalizeProviderDescriptor({
      id: 'github',
      type: 'oauth',
    });
    expect(result).toEqual({
      id: 'github',
      name: 'github',
      type: 'oauth',
    });
  });

  it('returns null for null input', () => {
    expect(normalizeProviderDescriptor(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizeProviderDescriptor('not-an-object')).toBeNull();
    expect(normalizeProviderDescriptor(42)).toBeNull();
  });

  it('returns null for missing id', () => {
    expect(
      normalizeProviderDescriptor({ name: 'Test', type: 'oauth' }),
    ).toBeNull();
  });

  it('returns null for missing type', () => {
    expect(
      normalizeProviderDescriptor({ id: 'test', name: 'Test' }),
    ).toBeNull();
  });

  it('returns null for invalid type', () => {
    expect(
      normalizeProviderDescriptor({ id: 'test', type: 'invalid' }),
    ).toBeNull();
  });
});

describe('validateProviders', () => {
  it('returns descriptors for valid providers', () => {
    const result = validateProviders([
      { id: 'google', name: 'Google', type: 'oauth' },
      { id: 'github', name: 'GitHub', type: 'oauth' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('google');
    expect(result[1].id).toBe('github');
  });

  it('filters out invalid providers', () => {
    const result = validateProviders([
      { id: 'google', name: 'Google', type: 'oauth' },
      null,
      'not-an-object',
      { id: 'missing-type' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('google');
  });

  it('returns empty array for empty input', () => {
    expect(validateProviders([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Config factory
// ---------------------------------------------------------------------------

describe('createAuthjsConfig', () => {
  const originalEnv = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    } else {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = originalEnv;
    }
  });

  it('throws AuthjsRuntimeDisabledError when feature flag is off', () => {
    delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    expect(() => createAuthjsConfig(validConfigInput())).toThrow(
      AuthjsRuntimeDisabledError,
    );
  });

  it('throws when AUTH_SECRET is missing', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    expect(() =>
      createAuthjsConfig(
        validConfigInput({ secrets: { authSecret: '' } }),
      ),
    ).toThrow(AUTHJS_MISSING_SECRET_MESSAGE);
  });

  it('creates valid config when enabled with valid input', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    const adapter = mockAdapter();
    const result = createAuthjsConfig({
      adapter,
      providers: [],
      secrets: { authSecret: 'my-secret-value' },
      baseUrl: 'https://app.example.com',
      debug: true,
    });

    expect(result.adapter).toBe(adapter);
    expect(result.providers).toEqual([]);
    expect(result.session).toEqual({ strategy: 'jwt' });
    expect(result.secret).toBe('my-secret-value');
    expect(result.basePath).toBe('https://app.example.com');
    expect(result.debug).toBe(true);
    expect(result.featureGateEnabled).toBe(true);
  });

  it('enforces JWT session strategy', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    const result = createAuthjsConfig(validConfigInput());
    expect(result.session.strategy).toBe(AUTHJS_SESSION_STRATEGY);
    expect(result.session.strategy).toBe('jwt');
  });

  it('defaults debug to false', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    const result = createAuthjsConfig(validConfigInput());
    expect(result.debug).toBe(false);
  });

  it('passes through providers array', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    const providers = [
      { id: 'google', name: 'Google', type: 'oauth' },
    ];
    const result = createAuthjsConfig(validConfigInput({ providers }));
    expect(result.providers).toBe(providers);
  });
});

// ---------------------------------------------------------------------------
// tryCreateAuthjsConfig
// ---------------------------------------------------------------------------

describe('tryCreateAuthjsConfig', () => {
  const originalEnv = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    } else {
      process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = originalEnv;
    }
  });

  it('returns null when feature flag is off (does not throw)', () => {
    delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    const result = tryCreateAuthjsConfig(validConfigInput());
    expect(result).toBeNull();
  });

  it('returns config when feature flag is on', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    const result = tryCreateAuthjsConfig(validConfigInput());
    expect(result).not.toBeNull();
    expect(result!.featureGateEnabled).toBe(true);
    expect(result!.session.strategy).toBe('jwt');
  });

  it('still throws on invalid secret even when enabled', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    expect(() =>
      tryCreateAuthjsConfig(
        validConfigInput({ secrets: { authSecret: '' } }),
      ),
    ).toThrow(AUTHJS_MISSING_SECRET_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// Scope guard tests
// ---------------------------------------------------------------------------

describe('TASK-0033 scope guard tests', () => {
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

  it('src/app/** does not import authjs-feature-gate', () => {
    const violations = filesContainImport(
      path.join(SRC_ROOT, 'app'),
      'authjs-feature-gate',
    );
    expect(violations).toEqual([]);
  });

  it('src/app/** does not import authjs-runtime-config', () => {
    const violations = filesContainImport(
      path.join(SRC_ROOT, 'app'),
      'authjs-runtime-config',
    );
    expect(violations).toEqual([]);
  });

  it('src/domains/** does not import auth feature gate or config', () => {
    const domainsDir = path.join(SRC_ROOT, 'domains');
    const gateViolations = filesContainImport(domainsDir, 'authjs-feature-gate');
    const configViolations = filesContainImport(domainsDir, 'authjs-runtime-config');
    expect(gateViolations).toEqual([]);
    expect(configViolations).toEqual([]);
  });

  it('no middleware.ts was added', () => {
    expect(fs.existsSync(path.join(SRC_ROOT, 'middleware.ts'))).toBe(false);
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'middleware.ts'))).toBe(false);
  });

  it('no auth route handlers were added', () => {
    expect(
      fs.existsSync(path.join(SRC_ROOT, 'app', 'api', 'auth')),
    ).toBe(false);
  });

  it('prisma/schema.prisma was not changed in this task', () => {
    const schema = fs.readFileSync(
      path.join(PROJECT_ROOT, 'prisma', 'schema.prisma'),
      'utf-8',
    );
    expect(schema).toContain('TASK-0031');
    expect(schema).not.toContain('TASK-0033');
  });

  it('no migration files were added in this task', () => {
    const migrationsDir = path.join(PROJECT_ROOT, 'prisma', 'migrations');
    const dirs = fs.readdirSync(migrationsDir).filter(
      (d) => d.includes('0033') || d.includes('feature_flag'),
    );
    expect(dirs).toEqual([]);
  });

  it('no .env or .env.example files were changed', () => {
    // These files should not exist or should not contain ENABLE_AUTHJS_RUNTIME
    const envFile = path.join(PROJECT_ROOT, '.env');
    const envExample = path.join(PROJECT_ROOT, '.env.example');

    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      expect(content).not.toContain('ENABLE_AUTHJS_RUNTIME');
    }

    if (fs.existsSync(envExample)) {
      const content = fs.readFileSync(envExample, 'utf-8');
      expect(content).not.toContain('ENABLE_AUTHJS_RUNTIME');
    }
  });

  it('runtime config module does not import getPrisma or PrismaClient', () => {
    const configSource = fs.readFileSync(
      path.resolve(SRC_ROOT, 'lib/auth/authjs-runtime-config.ts'),
      'utf-8',
    );
    const codeOnly = configSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain('getPrisma');
    expect(codeOnly).not.toContain('PrismaClient');
  });

  it('feature gate module does not import next-auth', () => {
    const gateSource = fs.readFileSync(
      path.resolve(SRC_ROOT, 'lib/auth/authjs-feature-gate.ts'),
      'utf-8',
    );
    expect(gateSource).not.toContain("from 'next-auth");
    expect(gateSource).not.toContain('from "next-auth');
  });
});

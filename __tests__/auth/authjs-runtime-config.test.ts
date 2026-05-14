import { describe, it, expect, vi } from 'vitest';
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
  describe('AUTHJS_RUNTIME_FEATURE_FLAG', () => {
    it('equals ENABLE_AUTHJS_RUNTIME', () => {
      expect(AUTHJS_RUNTIME_FEATURE_FLAG).toBe('ENABLE_AUTHJS_RUNTIME');
    });
  });

  describe('isAuthjsRuntimeEnabled', () => {
    it('returns false when env var is undefined', () => {
      expect(isAuthjsRuntimeEnabled({})).toBe(false);
    });

    it('returns false when env var is empty', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: '' })).toBe(false);
    });

    it('returns false when env var is "false"', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: 'false' })).toBe(false);
    });

    it('returns false when env var is "0"', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: '0' })).toBe(false);
    });

    it('returns false when env var is "1"', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: '1' })).toBe(false);
    });

    it('returns false when env var is "TRUE"', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: 'TRUE' })).toBe(false);
    });

    it('returns false when env var is "True"', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: 'True' })).toBe(false);
    });

    it('returns false when env var is " true " (with whitespace)', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: ' true ' })).toBe(false);
    });

    it('returns false when env var is "yes"', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: 'yes' })).toBe(false);
    });

    it('returns false when env var is arbitrary string', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: 'maybe' })).toBe(false);
    });

    it('returns true only for exact "true"', () => {
      expect(isAuthjsRuntimeEnabled({ ENABLE_AUTHJS_RUNTIME: 'true' })).toBe(true);
    });

    it('defaults to process.env when no env provided', () => {
      // With no ENABLE_AUTHJS_RUNTIME in process.env, should return false
      const saved = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
      try {
        expect(isAuthjsRuntimeEnabled()).toBe(false);
      } finally {
        if (saved !== undefined) process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = saved;
      }
    });
  });

  describe('assertAuthjsRuntimeEnabled', () => {
    it('throws AuthjsRuntimeDisabledError when disabled', () => {
      expect(() => assertAuthjsRuntimeEnabled('testOp', {})).toThrow(
        AuthjsRuntimeDisabledError,
      );
    });

    it('includes operation name in error message', () => {
      expect(() =>
        assertAuthjsRuntimeEnabled('createAuthjsConfig', {}),
      ).toThrow(/createAuthjsConfig/);
    });

    it('includes feature flag name in error message', () => {
      expect(() => assertAuthjsRuntimeEnabled('test', {})).toThrow(
        /ENABLE_AUTHJS_RUNTIME/,
      );
    });

    it('does not throw when enabled', () => {
      expect(() =>
        assertAuthjsRuntimeEnabled('testOp', { ENABLE_AUTHJS_RUNTIME: 'true' }),
      ).not.toThrow();
    });

    it('throws for "TRUE" (strict)', () => {
      expect(() =>
        assertAuthjsRuntimeEnabled('testOp', { ENABLE_AUTHJS_RUNTIME: 'TRUE' }),
      ).toThrow(AuthjsRuntimeDisabledError);
    });

    it('throws for "1" (strict)', () => {
      expect(() =>
        assertAuthjsRuntimeEnabled('testOp', { ENABLE_AUTHJS_RUNTIME: '1' }),
      ).toThrow(AuthjsRuntimeDisabledError);
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
  const enabledEnv = { ENABLE_AUTHJS_RUNTIME: 'true' };

  it('throws AuthjsRuntimeDisabledError when feature flag is off', () => {
    const saved = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    try {
      expect(() => createAuthjsConfig(validConfigInput())).toThrow(
        AuthjsRuntimeDisabledError,
      );
    } finally {
      if (saved !== undefined) process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = saved;
    }
  });

  it('throws when AUTH_SECRET is missing', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    try {
      expect(() =>
        createAuthjsConfig(
          validConfigInput({ secrets: { authSecret: '' } }),
        ),
      ).toThrow(AUTHJS_MISSING_SECRET_MESSAGE);
    } finally {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
  });

  it('creates valid config when enabled with valid input', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    try {
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
    } finally {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
  });

  it('enforces JWT session strategy', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    try {
      const result = createAuthjsConfig(validConfigInput());
      expect(result.session.strategy).toBe(AUTHJS_SESSION_STRATEGY);
      expect(result.session.strategy).toBe('jwt');
    } finally {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
  });

  it('defaults debug to false', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    try {
      const result = createAuthjsConfig(validConfigInput());
      expect(result.debug).toBe(false);
    } finally {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
  });

  it('passes through providers array', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    try {
      const providers = [{ id: 'google', name: 'Google', type: 'oauth' }];
      const result = createAuthjsConfig(validConfigInput({ providers }));
      expect(result.providers).toBe(providers);
    } finally {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
  });
});

// ---------------------------------------------------------------------------
// tryCreateAuthjsConfig
// ---------------------------------------------------------------------------

describe('tryCreateAuthjsConfig', () => {
  it('returns null when feature flag is off (does not throw)', () => {
    const saved = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    try {
      const result = tryCreateAuthjsConfig(validConfigInput());
      expect(result).toBeNull();
    } finally {
      if (saved !== undefined) process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = saved;
    }
  });

  it('returns config when feature flag is on', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    try {
      const result = tryCreateAuthjsConfig(validConfigInput());
      expect(result).not.toBeNull();
      expect(result!.featureGateEnabled).toBe(true);
      expect(result!.session.strategy).toBe('jwt');
    } finally {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
  });

  it('still throws on invalid secret even when enabled', () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    try {
      expect(() =>
        tryCreateAuthjsConfig(
          validConfigInput({ secrets: { authSecret: '' } }),
        ),
      ).toThrow(AUTHJS_MISSING_SECRET_MESSAGE);
    } finally {
      delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
    }
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

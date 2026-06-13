// ===========================================================================
// Tests — Dev-Bypass Deployment Guard (A-R2)
//
// Verifies the fail-closed guard across every required env combination:
//   * real-data + ENABLE_DEV_AUTH_CONTEXT=true            -> boot fails closed
//   * real-data + VITE_DEV_BUSINESS_ID set                -> fails closed
//   * real-data + ENABLE_AUTHJS_REQUEST_CONTEXT!=true     -> fails closed
//   * real-data + correct flags (authjs on, dev off)      -> boots OK
//   * non-real-data + dev flags on                        -> boots OK (local)
//
// Also verifies the adapter-selection chokepoint (getDefaultAuthContextAdapter)
// fails closed in a real-data environment. Pure logic — no DB / server.
// ===========================================================================

import { describe, it, expect, afterEach } from 'vitest';

import {
  isRealDataEnvironment,
  evaluateDevBypassGuard,
  assertDevBypassGuard,
  DevBypassGuardError,
  ENABLE_AUTHJS_REQUEST_CONTEXT,
  ENABLE_DEV_AUTH_CONTEXT,
  VITE_DEV_BUSINESS_ID,
} from '@/lib/security/dev-bypass-guard';

import { getDefaultAuthContextAdapter } from '@/app/api/_shared/auth-context-adapter';

type Env = Record<string, string | undefined>;

/** Correct real-data baseline: authjs on, dev bypass off. */
const REAL_DATA_OK: Env = {
  NODE_ENV: 'production',
  [ENABLE_AUTHJS_REQUEST_CONTEXT]: 'true',
};

// ---------------------------------------------------------------------------
// isRealDataEnvironment
// ---------------------------------------------------------------------------

describe('isRealDataEnvironment', () => {
  it('treats NODE_ENV=production as real-data', () => {
    expect(isRealDataEnvironment({ NODE_ENV: 'production' })).toBe(true);
  });

  it('treats Vercel production/preview deployments as real-data', () => {
    expect(isRealDataEnvironment({ VERCEL_ENV: 'production' })).toBe(true);
    expect(isRealDataEnvironment({ VERCEL_ENV: 'preview' })).toBe(true);
  });

  it('treats local dev / test / unset as NON-real-data', () => {
    expect(isRealDataEnvironment({ NODE_ENV: 'development' })).toBe(false);
    expect(isRealDataEnvironment({ NODE_ENV: 'test' })).toBe(false);
    expect(isRealDataEnvironment({ VERCEL_ENV: 'development' })).toBe(false);
    expect(isRealDataEnvironment({})).toBe(false);
  });

  it('explicit local/test NODE_ENV wins over Vercel CLI VERCEL_ENV (PATCH-1)', () => {
    // Vercel CLI can write VERCEL_ENV="preview" into a local .env.local while
    // the developer runs `next dev` — this must NOT be real-data.
    expect(
      isRealDataEnvironment({ NODE_ENV: 'development', VERCEL_ENV: 'preview' }),
    ).toBe(false);
    expect(
      isRealDataEnvironment({ NODE_ENV: 'development', VERCEL_ENV: 'production' }),
    ).toBe(false);
    expect(
      isRealDataEnvironment({ NODE_ENV: 'test', VERCEL_ENV: 'preview' }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PATCH-1 — local Vercel CLI false-positive
// ---------------------------------------------------------------------------

describe('PATCH-1 — local Vercel CLI env stays usable', () => {
  it('development + VERCEL_ENV=preview + ENABLE_DEV_AUTH_CONTEXT=true -> passes', () => {
    const result = evaluateDevBypassGuard({
      NODE_ENV: 'development',
      VERCEL_ENV: 'preview',
      [ENABLE_DEV_AUTH_CONTEXT]: 'true',
    });
    expect(result.realData).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('development + VERCEL_ENV=preview + ENABLE_AUTHJS_REQUEST_CONTEXT="" -> passes', () => {
    const result = evaluateDevBypassGuard({
      NODE_ENV: 'development',
      VERCEL_ENV: 'preview',
      [ENABLE_AUTHJS_REQUEST_CONTEXT]: '',
    });
    expect(result.realData).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('test + VERCEL_ENV=preview -> passes', () => {
    const result = evaluateDevBypassGuard({
      NODE_ENV: 'test',
      VERCEL_ENV: 'preview',
    });
    expect(result.realData).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('still fails closed for a deployed preview without local NODE_ENV override', () => {
    // No development/test NODE_ENV -> a deployed Vercel preview is real-data.
    const result = evaluateDevBypassGuard({
      VERCEL_ENV: 'preview',
      [ENABLE_DEV_AUTH_CONTEXT]: 'true',
    });
    expect(result.realData).toBe(true);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateDevBypassGuard — required env matrix
// ---------------------------------------------------------------------------

describe('evaluateDevBypassGuard — required env matrix', () => {
  it('real-data + ENABLE_DEV_AUTH_CONTEXT=true -> fails closed', () => {
    const result = evaluateDevBypassGuard({
      ...REAL_DATA_OK,
      [ENABLE_DEV_AUTH_CONTEXT]: 'true',
    });
    expect(result.ok).toBe(false);
    expect(result.realData).toBe(true);
    expect(result.violations.map((v) => v.flag)).toContain(
      ENABLE_DEV_AUTH_CONTEXT,
    );
  });

  it('real-data + VITE_DEV_BUSINESS_ID set -> fails closed', () => {
    const result = evaluateDevBypassGuard({
      ...REAL_DATA_OK,
      [VITE_DEV_BUSINESS_ID]: 'biz_123',
    });
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.flag)).toContain(VITE_DEV_BUSINESS_ID);
  });

  it('real-data + ENABLE_AUTHJS_REQUEST_CONTEXT != true -> fails closed (no silent downgrade)', () => {
    const missing = evaluateDevBypassGuard({ NODE_ENV: 'production' });
    expect(missing.ok).toBe(false);
    expect(missing.violations.map((v) => v.flag)).toContain(
      ENABLE_AUTHJS_REQUEST_CONTEXT,
    );

    const wrongValue = evaluateDevBypassGuard({
      NODE_ENV: 'production',
      [ENABLE_AUTHJS_REQUEST_CONTEXT]: 'false',
    });
    expect(wrongValue.ok).toBe(false);
  });

  it('real-data + correct flags (authjs on, dev off) -> boots OK', () => {
    const result = evaluateDevBypassGuard(REAL_DATA_OK);
    expect(result.ok).toBe(true);
    expect(result.realData).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('non-real-data + dev flags on -> boots OK (local dev unchanged)', () => {
    const result = evaluateDevBypassGuard({
      NODE_ENV: 'development',
      [ENABLE_DEV_AUTH_CONTEXT]: 'true',
      [VITE_DEV_BUSINESS_ID]: 'biz_dev',
    });
    expect(result.ok).toBe(true);
    expect(result.realData).toBe(false);
    expect(result.violations).toHaveLength(0);
  });

  it('reports every offending flag at once', () => {
    const result = evaluateDevBypassGuard({
      NODE_ENV: 'production',
      [ENABLE_DEV_AUTH_CONTEXT]: 'true',
      [VITE_DEV_BUSINESS_ID]: 'biz_123',
      // ENABLE_AUTHJS_REQUEST_CONTEXT intentionally missing
    });
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.flag).sort()).toEqual(
      [
        ENABLE_AUTHJS_REQUEST_CONTEXT,
        ENABLE_DEV_AUTH_CONTEXT,
        VITE_DEV_BUSINESS_ID,
      ].sort(),
    );
  });

  it('only the exact string "true" enables a flag', () => {
    // dev flag with a truthy-but-not-"true" value is NOT treated as enabled
    const result = evaluateDevBypassGuard({
      ...REAL_DATA_OK,
      [ENABLE_DEV_AUTH_CONTEXT]: 'TRUE',
    });
    expect(result.ok).toBe(true);
    // and authjs must be exactly "true"
    expect(
      evaluateDevBypassGuard({ NODE_ENV: 'production', [ENABLE_AUTHJS_REQUEST_CONTEXT]: '1' }).ok,
    ).toBe(false);
  });

  it('ignores whitespace-only VITE_DEV_BUSINESS_ID', () => {
    const result = evaluateDevBypassGuard({
      ...REAL_DATA_OK,
      [VITE_DEV_BUSINESS_ID]: '   ',
    });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// assertDevBypassGuard
// ---------------------------------------------------------------------------

describe('assertDevBypassGuard', () => {
  it('throws DevBypassGuardError naming the offending flag in real-data', () => {
    expect(() =>
      assertDevBypassGuard({ ...REAL_DATA_OK, [ENABLE_DEV_AUTH_CONTEXT]: 'true' }),
    ).toThrow(DevBypassGuardError);

    try {
      assertDevBypassGuard({ ...REAL_DATA_OK, [ENABLE_DEV_AUTH_CONTEXT]: 'true' });
    } catch (err) {
      expect(err).toBeInstanceOf(DevBypassGuardError);
      expect((err as Error).message).toContain(ENABLE_DEV_AUTH_CONTEXT);
    }
  });

  it('does not throw for correct real-data config', () => {
    expect(() => assertDevBypassGuard(REAL_DATA_OK)).not.toThrow();
  });

  it('does not throw for local dev with dev flags on', () => {
    expect(() =>
      assertDevBypassGuard({
        NODE_ENV: 'development',
        [ENABLE_DEV_AUTH_CONTEXT]: 'true',
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Adapter-selection chokepoint (defense-in-depth)
// ---------------------------------------------------------------------------

describe('getDefaultAuthContextAdapter chokepoint', () => {
  const saved: Env = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    [ENABLE_AUTHJS_REQUEST_CONTEXT]: process.env[ENABLE_AUTHJS_REQUEST_CONTEXT],
    [ENABLE_DEV_AUTH_CONTEXT]: process.env[ENABLE_DEV_AUTH_CONTEXT],
    [VITE_DEV_BUSINESS_ID]: process.env[VITE_DEV_BUSINESS_ID],
  };

  function set(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) set(k, v);
  });

  it('refuses to hand out the dev adapter in a real-data environment', () => {
    // PATCH-1: a deployed runtime is not NODE_ENV development/test.
    set('NODE_ENV', 'production');
    set('VERCEL_ENV', 'production');
    set(ENABLE_AUTHJS_REQUEST_CONTEXT, undefined);
    set(ENABLE_DEV_AUTH_CONTEXT, 'true');
    expect(() => getDefaultAuthContextAdapter()).toThrow(DevBypassGuardError);
  });

  it('returns an adapter for correct real-data config', () => {
    set('NODE_ENV', 'production');
    set('VERCEL_ENV', 'production');
    set(ENABLE_AUTHJS_REQUEST_CONTEXT, 'true');
    set(ENABLE_DEV_AUTH_CONTEXT, undefined);
    set(VITE_DEV_BUSINESS_ID, undefined);
    expect(() => getDefaultAuthContextAdapter()).not.toThrow();
  });

  it('returns the dev adapter normally in local (non-real-data) env', () => {
    set('NODE_ENV', 'development');
    set('VERCEL_ENV', undefined);
    set(ENABLE_AUTHJS_REQUEST_CONTEXT, undefined);
    set(ENABLE_DEV_AUTH_CONTEXT, 'true');
    expect(() => getDefaultAuthContextAdapter()).not.toThrow();
  });
});

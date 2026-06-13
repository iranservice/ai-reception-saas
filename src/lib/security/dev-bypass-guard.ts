// ===========================================================================
// Security — Dev-Bypass Deployment Guard (A-R2)
//
// Makes it impossible for the dev-header auth bypass to be active in any
// real-data environment.
//
// The dev-header adapter (createDevHeaderAuthContextAdapter) trusts
// x-dev-* headers with NO database membership check. It is inert unless
// ENABLE_DEV_AUTH_CONTEXT === "true", and the real Auth.js adapter is only
// selected when ENABLE_AUTHJS_REQUEST_CONTEXT === "true". Real-data safety
// therefore depends entirely on environment configuration.
//
// This module turns that convention into an ENFORCED, FAIL-CLOSED guard:
// in a real-data environment the application refuses to start (and the
// adapter selection refuses to hand out the dev adapter) unless the auth
// configuration is correct.
//
// Scope guard: this module ONLY decides WHEN the dev path may be enabled.
// It does not change the behavior of the real Auth.js tenant adapter or
// the dev-header adapter internals.
//
// Strictness: matches the existing feature-gate convention — only the exact
// string "true" enables a flag. No trimming/case/numeric truthiness.
//
// References: AREA-A-authorization.md §5 (dev-bypass risk) / §10 blocker 2;
// AREA-A-remediation-plan.md workstream A-R2.
// ===========================================================================

// ---------------------------------------------------------------------------
// Flag / signal names
// ---------------------------------------------------------------------------

/** Must be "true" in a real-data environment. */
export const ENABLE_AUTHJS_REQUEST_CONTEXT = 'ENABLE_AUTHJS_REQUEST_CONTEXT' as const;

/** Must NOT be "true" in a real-data environment (dev-header bypass). */
export const ENABLE_DEV_AUTH_CONTEXT = 'ENABLE_DEV_AUTH_CONTEXT' as const;

/**
 * Frontend dev business-context override (companion frontend repo's
 * VITE_DEV_BUSINESS_ID). Must be absent in a real-data environment. The
 * backend cannot read the frontend's Vite env at runtime, but if this name
 * ever leaks into the server process it is treated as a dev-bypass signal.
 */
export const VITE_DEV_BUSINESS_ID = 'VITE_DEV_BUSINESS_ID' as const;

// ---------------------------------------------------------------------------
// Real-data environment detection
// ---------------------------------------------------------------------------

type EnvRecord = Record<string, string | undefined>;

/**
 * Returns true if the given environment is one where real customer data can
 * exist, i.e. a place where the dev-header bypass would be catastrophic.
 *
 * Uses EXISTING signals only (no new config surface):
 * - An explicit local/test runtime (NODE_ENV "development" or "test") is
 *   NEVER real-data — and this wins over any deployment marker. The Vercel
 *   CLI can generate a local `.env.local` containing VERCEL_ENV="preview"
 *   while the developer runs `next dev`; that must stay NON-real-data.
 * - NODE_ENV === "production"  (a production Node/Next runtime) is real-data.
 * - VERCEL_ENV is "production" or "preview"  (a deployed Vercel runtime —
 *   publicly reachable, may connect to real/shared data) is real-data, EXCEPT
 *   when NODE_ENV is explicitly development/test (the local-CLI case above).
 *
 * Everything else (local `next dev`, NODE_ENV=development, NODE_ENV=test,
 * CI without a deployment marker) is treated as NON-real-data, so local
 * development and the test suite keep working with dev headers exactly as
 * today.
 *
 * Fail-closed bias: when in doubt, more environments are treated as
 * real-data, never fewer.
 */
export function isRealDataEnvironment(env: EnvRecord = process.env): boolean {
  // Explicit local/test runtime always wins over deployment markers.
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return false;

  if (env.NODE_ENV === 'production') return true;

  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;

  return false;
}

// ---------------------------------------------------------------------------
// Guard evaluation
// ---------------------------------------------------------------------------

/** A single reason the dev-bypass guard rejected the configuration. */
export interface DevBypassGuardViolation {
  /** The offending environment variable / flag name. */
  readonly flag: string;
  /** Human-readable explanation of what is wrong and how to fix it. */
  readonly detail: string;
}

/** Result of evaluating the dev-bypass guard against an environment. */
export interface DevBypassGuardResult {
  /** True when the configuration is safe to boot. */
  readonly ok: boolean;
  /** Whether the evaluated environment is a real-data environment. */
  readonly realData: boolean;
  /** Empty when ok; otherwise one entry per offending flag. */
  readonly violations: readonly DevBypassGuardViolation[];
}

/** Returns true when a value is present (defined and non-whitespace). */
function isPresent(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Evaluates the dev-bypass guard for an environment WITHOUT throwing.
 *
 * In a NON-real-data environment the guard always passes — dev headers and
 * the frontend businessId override continue to work exactly as today.
 *
 * In a real-data environment the configuration is rejected (does NOT
 * silently downgrade) if any of the following hold:
 *   - ENABLE_AUTHJS_REQUEST_CONTEXT is not exactly "true"
 *   - ENABLE_DEV_AUTH_CONTEXT is exactly "true"
 *   - VITE_DEV_BUSINESS_ID is present in the server environment
 */
export function evaluateDevBypassGuard(
  env: EnvRecord = process.env,
): DevBypassGuardResult {
  if (!isRealDataEnvironment(env)) {
    return { ok: true, realData: false, violations: [] };
  }

  const violations: DevBypassGuardViolation[] = [];

  if (env[ENABLE_AUTHJS_REQUEST_CONTEXT] !== 'true') {
    violations.push({
      flag: ENABLE_AUTHJS_REQUEST_CONTEXT,
      detail:
        `must be "true" in a real-data environment so the real Auth.js ` +
        `tenant adapter is selected (current value: ` +
        `${formatValue(env[ENABLE_AUTHJS_REQUEST_CONTEXT])}). Without it the ` +
        `application would silently fall back to the dev-header adapter.`,
    });
  }

  if (env[ENABLE_DEV_AUTH_CONTEXT] === 'true') {
    violations.push({
      flag: ENABLE_DEV_AUTH_CONTEXT,
      detail:
        `must NOT be "true" in a real-data environment. The dev-header ` +
        `adapter trusts x-dev-* headers with no membership check and ` +
        `fully bypasses tenant isolation.`,
    });
  }

  if (isPresent(env[VITE_DEV_BUSINESS_ID])) {
    violations.push({
      flag: VITE_DEV_BUSINESS_ID,
      detail:
        `must be unset in a real-data environment. It is a frontend ` +
        `dev business-context override and its presence in the server ` +
        `process indicates a leaked dev-bypass configuration.`,
    });
  }

  return { ok: violations.length === 0, realData: true, violations };
}

function formatValue(value: string | undefined): string {
  return value === undefined ? 'unset' : JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Fail-closed assertion
// ---------------------------------------------------------------------------

/** Thrown at bootstrap when a real-data environment enables dev bypass. */
export class DevBypassGuardError extends Error {
  readonly violations: readonly DevBypassGuardViolation[];

  constructor(violations: readonly DevBypassGuardViolation[]) {
    const lines = violations
      .map((v) => `  - ${v.flag}: ${v.detail}`)
      .join('\n');
    super(
      `Refusing to start: dev-bypass auth is not allowed in a real-data ` +
        `environment.\n${lines}\n` +
        `Fix the environment configuration, or run locally with ` +
        `NODE_ENV=development (next dev) where dev headers are permitted.`,
    );
    this.name = 'DevBypassGuardError';
    this.violations = violations;
  }
}

/**
 * Asserts that the dev-bypass guard passes for the given environment.
 * Throws {@link DevBypassGuardError} (fail-closed) when it does not.
 *
 * Safe to call from a bootstrap hook and from the adapter selection point —
 * it is a few string comparisons with no I/O.
 */
export function assertDevBypassGuard(env: EnvRecord = process.env): void {
  const result = evaluateDevBypassGuard(env);
  if (!result.ok) {
    throw new DevBypassGuardError(result.violations);
  }
}

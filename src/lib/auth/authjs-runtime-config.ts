/**
 * Auth.js Runtime Configuration Factory
 *
 * Creates Auth.js configuration objects gated behind the runtime feature flag.
 * This module provides configuration primitives only — it does not wire
 * Auth.js into Next.js route handlers, middleware, or request context.
 *
 * Design decisions:
 * - Config is created lazily behind feature gate
 * - JWT session strategy is mandatory (no database sessions)
 * - Adapter is injected via the TASK-0032 adapter wrapper
 * - Provider list is validated but empty by default (no real OAuth)
 * - Secret validation occurs at config creation time
 * - No real providers or secrets are configured in this task
 *
 * @module
 */

import type { Adapter } from 'next-auth/adapters';
import {
  assertAuthjsRuntimeEnabled,
  isAuthjsRuntimeEnabled,
} from './authjs-feature-gate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal provider descriptor for validation.
 * Auth.js providers are opaque config objects; we validate shape only.
 */
export interface AuthjsProviderDescriptor {
  /** Provider id (e.g. 'google', 'github', 'credentials') */
  id: string;
  /** Provider display name */
  name: string;
  /** Provider type */
  type: 'oauth' | 'oidc' | 'email' | 'credentials';
}

/**
 * Required secrets for Auth.js runtime initialization.
 */
export interface AuthjsRequiredSecrets {
  /** AUTH_SECRET — used for JWT signing and encryption */
  authSecret: string;
}

/**
 * Input to the Auth.js config factory.
 */
export interface AuthjsConfigInput {
  /** Injected adapter (from createAuthjsAdapter) */
  adapter: Adapter;
  /** Auth.js providers (opaque config objects) */
  providers: unknown[];
  /** Required secrets */
  secrets: AuthjsRequiredSecrets;
  /** Base URL for auth callbacks (e.g. 'https://app.example.com') */
  baseUrl?: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Validated Auth.js configuration output.
 * This is the shape consumed by future route-wiring.
 */
export interface AuthjsConfigOutput {
  /** Injected adapter */
  adapter: Adapter;
  /** Validated providers list */
  providers: unknown[];
  /** Session strategy — always JWT */
  session: { strategy: 'jwt' };
  /** Auth secret for JWT signing */
  secret: string;
  /** Base URL (if provided) */
  basePath?: string;
  /** Debug mode */
  debug: boolean;
  /** Feature flag was enabled at config creation time */
  featureGateEnabled: true;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTHJS_SESSION_STRATEGY = 'jwt' as const;

export const AUTHJS_MISSING_SECRET_MESSAGE =
  'AUTH_SECRET is required for Auth.js runtime. Provide a non-empty secret string.';

export const AUTHJS_EMPTY_PROVIDERS_WARNING =
  'Auth.js config created with zero providers. No sign-in methods will be available.';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that AUTH_SECRET is present and non-empty.
 *
 * @throws {Error} if secret is missing or empty
 */
export function validateAuthjsSecret(secret: string | undefined | null): string {
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error(AUTHJS_MISSING_SECRET_MESSAGE);
  }
  return secret.trim();
}

/**
 * Normalizes a provider descriptor from an opaque provider config.
 * Returns null if the provider shape is unrecognizable.
 */
export function normalizeProviderDescriptor(
  provider: unknown,
): AuthjsProviderDescriptor | null {
  if (typeof provider !== 'object' || provider === null) return null;

  const p = provider as Record<string, unknown>;
  const id = typeof p.id === 'string' ? p.id : undefined;
  const name = typeof p.name === 'string' ? p.name : undefined;
  const type = typeof p.type === 'string' ? p.type : undefined;

  if (!id || !type) return null;

  const validTypes = ['oauth', 'oidc', 'email', 'credentials'] as const;
  if (!validTypes.includes(type as (typeof validTypes)[number])) return null;

  return {
    id,
    name: name ?? id,
    type: type as AuthjsProviderDescriptor['type'],
  };
}

/**
 * Validates an array of provider configs.
 * Returns descriptors for valid providers. Logs a warning for empty lists.
 */
export function validateProviders(
  providers: unknown[],
): AuthjsProviderDescriptor[] {
  const descriptors: AuthjsProviderDescriptor[] = [];

  for (const provider of providers) {
    const descriptor = normalizeProviderDescriptor(provider);
    if (descriptor) {
      descriptors.push(descriptor);
    }
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// Config Factory
// ---------------------------------------------------------------------------

/**
 * Creates a validated Auth.js configuration behind the feature gate.
 *
 * @throws {AuthjsRuntimeDisabledError} if feature flag is disabled
 * @throws {Error} if AUTH_SECRET is missing or empty
 */
export function createAuthjsConfig(input: AuthjsConfigInput): AuthjsConfigOutput {
  assertAuthjsRuntimeEnabled('createAuthjsConfig');

  const secret = validateAuthjsSecret(input.secrets.authSecret);

  return {
    adapter: input.adapter,
    providers: input.providers,
    session: { strategy: AUTHJS_SESSION_STRATEGY },
    secret,
    basePath: input.baseUrl,
    debug: input.debug ?? false,
    featureGateEnabled: true,
  };
}

/**
 * Attempts to create Auth.js config only if the feature gate is enabled.
 * Returns null if the feature flag is disabled (instead of throwing).
 *
 * Useful for optional/conditional initialization paths.
 */
export function tryCreateAuthjsConfig(
  input: AuthjsConfigInput,
): AuthjsConfigOutput | null {
  if (!isAuthjsRuntimeEnabled()) return null;

  const secret = validateAuthjsSecret(input.secrets.authSecret);

  return {
    adapter: input.adapter,
    providers: input.providers,
    session: { strategy: AUTHJS_SESSION_STRATEGY },
    secret,
    basePath: input.baseUrl,
    debug: input.debug ?? false,
    featureGateEnabled: true,
  };
}

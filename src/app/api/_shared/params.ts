// ===========================================================================
// API Shared — Route Param and Query Utilities
//
// Helpers for validating route params and parsing query string values.
// ===========================================================================

import { z } from 'zod';
import { apiError } from './responses';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of validating route params */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

// ---------------------------------------------------------------------------
// Route param validation
// ---------------------------------------------------------------------------

/**
 * Validates route params against a Zod schema.
 *
 * Returns the parsed data on success, or an error response on failure.
 */
export function validateRouteParams<TSchema extends z.ZodType>(
  params: unknown,
  schema: TSchema,
  invalidCode: string,
  invalidMessage: string,
): ValidationResult<z.infer<TSchema>> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(invalidCode, invalidMessage, 400),
    };
  }
  return { ok: true, data: parsed.data };
}

// ---------------------------------------------------------------------------
// Query param parsing
// ---------------------------------------------------------------------------

/**
 * Parses a string query param as a boolean.
 *
 * - 'true' → true
 * - 'false' → false
 * - null or other → undefined
 */
export function parseBooleanQueryParam(
  value: string | null,
): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Parses a string query param as an integer.
 *
 * Returns undefined for null or non-integer strings.
 */
export function parseIntegerQueryParam(
  value: string | null,
): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  return parsed;
}

/**
 * Reads a query parameter from a request URL.
 */
export function getSearchParam(
  request: Request,
  key: string,
): string | null {
  return new URL(request.url).searchParams.get(key);
}

// ---------------------------------------------------------------------------
// Common param schemas
// ---------------------------------------------------------------------------

/**
 * Creates a Zod schema that validates an object with a single UUID param.
 *
 * @example
 * const schema = uuidParamSchema('businessId');
 * // schema validates { businessId: "uuid-string" }
 */
export function uuidParamSchema<TParam extends string>(
  paramName: TParam,
): z.ZodObject<Record<TParam, z.ZodString>> {
  return z.object({
    [paramName]: z.string().uuid(),
  } as Record<TParam, z.ZodString>);
}

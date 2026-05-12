// ===========================================================================
// API Shared — Request Body Utilities
//
// Safe JSON body reading and Zod schema validation for API requests.
// ===========================================================================

import { z } from 'zod';
import { apiError } from './responses';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of reading/validating a JSON request body */
export type JsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

// ---------------------------------------------------------------------------
// Body reading
// ---------------------------------------------------------------------------

/**
 * Safely reads and parses a JSON request body.
 *
 * Returns a failure response if the body is not valid JSON.
 */
export async function readJsonBody(
  request: Request,
): Promise<JsonBodyResult<unknown>> {
  try {
    const data: unknown = await request.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: apiError(
        'INVALID_JSON_BODY',
        'Invalid JSON request body',
        400,
      ),
    };
  }
}

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

/**
 * Reads a JSON body and validates it against a Zod schema.
 *
 * Returns the parsed data on success, or an error response on failure.
 */
export async function validateJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  invalidCode: string,
  invalidMessage: string,
): Promise<JsonBodyResult<z.infer<TSchema>>> {
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult;
  }

  const parsed = schema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(invalidCode, invalidMessage, 400),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Reads an optional JSON body and validates it against a Zod schema.
 *
 * Returns undefined if the body is empty/missing.
 * Returns the parsed data if the body is present and valid.
 * Returns an error response if the body is present but invalid.
 */
export async function readOptionalJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  invalidCode: string,
  invalidMessage: string,
): Promise<JsonBodyResult<z.infer<TSchema> | undefined>> {
  // Read raw text to detect empty bodies without consuming the stream twice
  const text = await request.text();

  if (text.trim() === '') {
    return { ok: true, data: undefined };
  }

  // Parse JSON from the raw text
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: apiError(
        'INVALID_JSON_BODY',
        'Invalid JSON request body',
        400,
      ),
    };
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(invalidCode, invalidMessage, 400),
    };
  }

  return { ok: true, data: parsed.data };
}

// ---------------------------------------------------------------------------
// Test / composition helper
// ---------------------------------------------------------------------------

/**
 * Creates a Request object with a JSON body.
 *
 * Utility for tests and internal handler composition.
 */
export function makeJsonRequest(
  body: unknown,
  init?: RequestInit,
): Request {
  const defaultHeaders = { 'content-type': 'application/json' };
  const initHeaders = init?.headers
    ? Object.fromEntries(new Headers(init.headers).entries())
    : {};

  return new Request('http://localhost/test', {
    method: 'POST',
    ...init,
    body: JSON.stringify(body),
    headers: { ...defaultHeaders, ...initHeaders },
  });
}

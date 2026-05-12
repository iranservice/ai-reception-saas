// ===========================================================================
// API Shared — ActionResult Response Utilities
//
// Converts domain ActionResult<T> values into HTTP JSON responses
// using the shared response envelope and error status mapping.
// ===========================================================================

import type { ActionResult } from '@/lib/result';
import { apiOk, apiError } from './responses';
import { getHttpStatusForError } from './errors';

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

/**
 * Converts an ActionResult<T> into a Response.
 *
 * - ok result → apiOk with status 200 (or custom via init)
 * - error result → apiError with mapped HTTP status
 */
export function actionResultToResponse<T>(
  result: ActionResult<T>,
  init?: ResponseInit,
): Response {
  if (result.ok) {
    return apiOk(result.data, init);
  }
  const status = getHttpStatusForError(result.error.code);
  return apiError(result.error.code, result.error.message, status);
}

/**
 * Converts an ActionResult<T> into a Response with a custom success status.
 *
 * - ok result → apiOk with the given successStatus
 * - error result → apiError with mapped HTTP status
 */
export function actionResultToResponseWithStatus<T>(
  result: ActionResult<T>,
  successStatus: number,
): Response {
  if (result.ok) {
    return apiOk(result.data, { status: successStatus });
  }
  const status = getHttpStatusForError(result.error.code);
  return apiError(result.error.code, result.error.message, status);
}

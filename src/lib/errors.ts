// ===========================================================================
// Shared Error Hierarchy
//
// All domain errors extend AppError.
// Domain-specific errors should extend from these base classes.
// ===========================================================================

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCode {
  // Generic
  UNKNOWN = 'UNKNOWN',
  INTERNAL = 'INTERNAL',

  // Auth / Access
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Data
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION',
  CONFLICT = 'CONFLICT',

  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Base error class for the entire platform.
 * All domain errors should extend this.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    httpStatus = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.severity = severity;
    this.details = details;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      ErrorCode.NOT_FOUND,
      404,
      ErrorSeverity.LOW,
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, ErrorCode.FORBIDDEN, 403, ErrorSeverity.HIGH);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, ErrorCode.UNAUTHORIZED, 401, ErrorSeverity.HIGH);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION, 400, ErrorSeverity.LOW, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT, 409, ErrorSeverity.MEDIUM);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, ErrorCode.RATE_LIMITED, 429, ErrorSeverity.MEDIUM);
  }
}

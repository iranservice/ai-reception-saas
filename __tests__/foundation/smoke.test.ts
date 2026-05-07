import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  RateLimitedError,
  ErrorCode,
  ErrorSeverity,
} from '@/lib/errors';
import {
  BusinessRole,
  AuditSeverity,
  ConversationStatus,
  OwnerType,
} from '@/lib/types';

describe('Foundation Smoke Test', () => {
  describe('Error Hierarchy', () => {
    it('AppError is constructable with defaults', () => {
      const err = new AppError('test error');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.message).toBe('test error');
      expect(err.code).toBe(ErrorCode.UNKNOWN);
      expect(err.httpStatus).toBe(500);
      expect(err.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('NotFoundError sets correct code and status', () => {
      const err = new NotFoundError('User', '123');
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.httpStatus).toBe(404);
      expect(err.message).toBe('User not found: 123');
    });

    it('ForbiddenError sets correct code and status', () => {
      const err = new ForbiddenError();
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.FORBIDDEN);
      expect(err.httpStatus).toBe(403);
    });

    it('UnauthorizedError sets correct code and status', () => {
      const err = new UnauthorizedError();
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(err.httpStatus).toBe(401);
    });

    it('ValidationError supports details', () => {
      const err = new ValidationError('invalid input', {
        field: 'email',
        reason: 'format',
      });
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.VALIDATION);
      expect(err.httpStatus).toBe(400);
      expect(err.details).toEqual({ field: 'email', reason: 'format' });
    });

    it('ConflictError sets correct code and status', () => {
      const err = new ConflictError('already exists');
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.CONFLICT);
      expect(err.httpStatus).toBe(409);
    });

    it('RateLimitedError sets correct code and status', () => {
      const err = new RateLimitedError();
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.RATE_LIMITED);
      expect(err.httpStatus).toBe(429);
    });
  });

  describe('Shared Types', () => {
    it('BusinessRole enum has expected values', () => {
      expect(BusinessRole.OWNER).toBe('owner');
      expect(BusinessRole.ADMIN).toBe('admin');
      expect(BusinessRole.OPERATOR).toBe('operator');
      expect(BusinessRole.VIEWER).toBe('viewer');
    });

    it('AuditSeverity enum has expected values', () => {
      expect(AuditSeverity.INFO).toBe('info');
      expect(AuditSeverity.WARNING).toBe('warning');
      expect(AuditSeverity.CRITICAL).toBe('critical');
    });

    it('ConversationStatus enum has expected values', () => {
      expect(ConversationStatus.OPEN).toBe('open');
      expect(ConversationStatus.CLOSED).toBe('closed');
      expect(ConversationStatus.ARCHIVED).toBe('archived');
    });

    it('OwnerType enum has expected values', () => {
      expect(OwnerType.AI).toBe('ai');
      expect(OwnerType.HUMAN).toBe('human');
      expect(OwnerType.UNASSIGNED).toBe('unassigned');
    });
  });

  describe('Error Severity Enum', () => {
    it('has all expected severity levels', () => {
      expect(ErrorSeverity.LOW).toBe('low');
      expect(ErrorSeverity.MEDIUM).toBe('medium');
      expect(ErrorSeverity.HIGH).toBe('high');
      expect(ErrorSeverity.CRITICAL).toBe('critical');
    });
  });

  describe('Error Code Enum', () => {
    it('has all expected error codes', () => {
      expect(ErrorCode.UNKNOWN).toBe('UNKNOWN');
      expect(ErrorCode.INTERNAL).toBe('INTERNAL');
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.VALIDATION).toBe('VALIDATION');
      expect(ErrorCode.CONFLICT).toBe('CONFLICT');
      expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
    });
  });
});

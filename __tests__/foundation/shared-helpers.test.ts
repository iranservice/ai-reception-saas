import { describe, it, expect, vi, afterEach } from 'vitest';
import { ok, err } from '@/lib/result';
import { env } from '@/lib/env';
import { nowIso, toIsoString } from '@/lib/time';
import { createId } from '@/lib/ids';

describe('Shared Helpers', () => {
  describe('result — ok helper', () => {
    it('returns { ok: true, data }', () => {
      const result = ok({ id: '123' });
      expect(result).toEqual({ ok: true, data: { id: '123' } });
    });
  });

  describe('result — err helper', () => {
    it('returns { ok: false, error: { code, message } }', () => {
      const result = err('NOT_FOUND', 'User not found');
      expect(result).toEqual({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    });
  });

  describe('env helper', () => {
    it('appUrl defaults to http://localhost:3000', () => {
      expect(env.appUrl).toBe('http://localhost:3000');
    });
  });

  describe('time — nowIso', () => {
    it('returns ISO string', () => {
      const result = nowIso();
      expect(result).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('time — toIsoString', () => {
    it('returns ISO string from Date', () => {
      const date = new Date('2025-01-01T00:00:00.000Z');
      const result = toIsoString(date);
      expect(result).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('ids — createId', () => {
    it('returns UUID-like string', () => {
      const id = createId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('with prefix starts with prefix_', () => {
      const id = createId('usr');
      expect(id).toMatch(/^usr_/);
      expect(id.length).toBeGreaterThan(4);
    });
  });

  describe('getPrisma', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      // Clear cached prisma instance
      const g = globalThis as unknown as { prisma?: unknown };
      delete g.prisma;
    });

    it('throws clear error when DATABASE_URL is missing', async () => {
      vi.stubEnv('DATABASE_URL', '');

      // Re-import to pick up the stubbed env
      // We need to reset modules so env.ts re-evaluates
      vi.resetModules();

      const { getPrisma } = await import('@/lib/prisma');

      expect(() => getPrisma()).toThrow(
        'DATABASE_URL is required to initialize Prisma Client.',
      );
    });
  });
});

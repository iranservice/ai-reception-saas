import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('Health Route', () => {
  it('returns { ok: true, service: "ai-reception-saas" }', async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: 'ai-reception-saas',
    });
  });
});

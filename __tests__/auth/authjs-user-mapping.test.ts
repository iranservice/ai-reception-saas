import { describe, it, expect } from 'vitest';
import {
  normalizeAuthjsEmail,
  resolveAuthjsDisplayName,
  normalizeAuthjsImage,
  mapInternalUserToAdapterUser,
  mapAdapterUserCreateInput,
  mapAdapterUserUpdateInput,
  AuthjsMappingError,
} from '../../src/lib/auth/authjs-user-mapping';

// ---------------------------------------------------------------------------
// normalizeAuthjsEmail
// ---------------------------------------------------------------------------

describe('normalizeAuthjsEmail', () => {
  it('normalizes email to lowercase', () => {
    expect(normalizeAuthjsEmail('Alice@Example.COM')).toBe('alice@example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeAuthjsEmail('  bob@example.com  ')).toBe('bob@example.com');
  });

  it('rejects null email', () => {
    expect(() => normalizeAuthjsEmail(null)).toThrow(AuthjsMappingError);
  });

  it('rejects undefined email', () => {
    expect(() => normalizeAuthjsEmail(undefined)).toThrow(AuthjsMappingError);
  });

  it('rejects empty string email', () => {
    expect(() => normalizeAuthjsEmail('')).toThrow(AuthjsMappingError);
    expect(() => normalizeAuthjsEmail('   ')).toThrow(AuthjsMappingError);
  });

  it('rejects non-string email', () => {
    expect(() => normalizeAuthjsEmail(42)).toThrow(AuthjsMappingError);
    expect(() => normalizeAuthjsEmail(true)).toThrow(AuthjsMappingError);
  });
});

// ---------------------------------------------------------------------------
// resolveAuthjsDisplayName
// ---------------------------------------------------------------------------

describe('resolveAuthjsDisplayName', () => {
  it('uses provider name when present', () => {
    expect(
      resolveAuthjsDisplayName({ name: 'Alice Smith', email: 'alice@test.com' }),
    ).toBe('Alice Smith');
  });

  it('trims provider name', () => {
    expect(
      resolveAuthjsDisplayName({ name: '  Bob  ', email: 'bob@test.com' }),
    ).toBe('Bob');
  });

  it('falls back to email local-part when name is null', () => {
    expect(
      resolveAuthjsDisplayName({ name: null, email: 'charlie@test.com' }),
    ).toBe('charlie');
  });

  it('falls back to email local-part when name is empty', () => {
    expect(
      resolveAuthjsDisplayName({ name: '', email: 'dave@test.com' }),
    ).toBe('dave');
  });

  it('falls back to email local-part when name is whitespace', () => {
    expect(
      resolveAuthjsDisplayName({ name: '   ', email: 'eve@test.com' }),
    ).toBe('eve');
  });

  it('falls back to email local-part when name is undefined', () => {
    expect(
      resolveAuthjsDisplayName({ email: 'frank@test.com' }),
    ).toBe('frank');
  });

  it('falls back to "User" when no usable name source exists', () => {
    expect(
      resolveAuthjsDisplayName({ name: null, email: '@malformed' }),
    ).toBe('User');
  });
});

// ---------------------------------------------------------------------------
// normalizeAuthjsImage
// ---------------------------------------------------------------------------

describe('normalizeAuthjsImage', () => {
  it('maps non-empty string image to avatarUrl', () => {
    expect(normalizeAuthjsImage('https://avatar.example.com/pic.jpg')).toBe(
      'https://avatar.example.com/pic.jpg',
    );
  });

  it('maps missing image to null', () => {
    expect(normalizeAuthjsImage(null)).toBeNull();
    expect(normalizeAuthjsImage(undefined)).toBeNull();
  });

  it('maps empty string image to null', () => {
    expect(normalizeAuthjsImage('')).toBeNull();
    expect(normalizeAuthjsImage('   ')).toBeNull();
  });

  it('maps non-string image to null', () => {
    expect(normalizeAuthjsImage(42)).toBeNull();
    expect(normalizeAuthjsImage(true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapInternalUserToAdapterUser
// ---------------------------------------------------------------------------

describe('mapInternalUserToAdapterUser', () => {
  it('maps internal avatarUrl back to adapter image', () => {
    const result = mapInternalUserToAdapterUser({
      id: 'uuid-1',
      email: 'alice@test.com',
      name: 'Alice',
      avatarUrl: 'https://pic.example.com/alice.jpg',
      emailVerified: new Date('2024-01-15'),
    });

    expect(result).toEqual({
      id: 'uuid-1',
      email: 'alice@test.com',
      name: 'Alice',
      image: 'https://pic.example.com/alice.jpg',
      emailVerified: new Date('2024-01-15'),
    });
  });

  it('maps null avatarUrl to null image', () => {
    const result = mapInternalUserToAdapterUser({
      id: 'uuid-2',
      email: 'bob@test.com',
      name: 'Bob',
      avatarUrl: null,
      emailVerified: null,
    });

    expect(result.image).toBeNull();
    expect(result.emailVerified).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapAdapterUserCreateInput
// ---------------------------------------------------------------------------

describe('mapAdapterUserCreateInput', () => {
  it('creates correct internal input from full provider data', () => {
    const result = mapAdapterUserCreateInput({
      id: 'provider-id-123',
      email: 'ALICE@Test.com',
      name: 'Alice Smith',
      image: 'https://pic.example.com/alice.jpg',
      emailVerified: new Date('2024-01-15'),
    });

    expect(result).toEqual({
      email: 'alice@test.com',
      name: 'Alice Smith',
      avatarUrl: 'https://pic.example.com/alice.jpg',
      emailVerified: new Date('2024-01-15'),
    });
  });

  it('never maps provider id to internal User.id in create input', () => {
    const result = mapAdapterUserCreateInput({
      id: 'provider-id-should-be-ignored',
      email: 'test@test.com',
      name: 'Test',
    });

    // Result should not have an id field
    expect(result).not.toHaveProperty('id');
  });

  it('applies name fallback when name is missing', () => {
    const result = mapAdapterUserCreateInput({
      email: 'bob@test.com',
      name: null,
    });

    expect(result.name).toBe('bob');
  });

  it('rejects missing email', () => {
    expect(() =>
      mapAdapterUserCreateInput({ email: null, name: 'Test' }),
    ).toThrow(AuthjsMappingError);
  });

  it('does not allow status, role, or tenant fields', () => {
    const input = {
      email: 'test@test.com',
      name: 'Test',
      // These should be silently ignored by the mapping
    } as Record<string, unknown>;
    input.status = 'SUSPENDED';
    input.role = 'ADMIN';
    input.businessId = 'tenant-123';

    const result = mapAdapterUserCreateInput(input as never);

    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('businessId');
    expect(result).not.toHaveProperty('locale');
  });
});

// ---------------------------------------------------------------------------
// mapAdapterUserUpdateInput
// ---------------------------------------------------------------------------

describe('mapAdapterUserUpdateInput', () => {
  it('maps image to avatarUrl on update', () => {
    const result = mapAdapterUserUpdateInput({
      id: 'uuid-1',
      image: 'https://new-pic.example.com/alice.jpg',
    });

    expect(result.avatarUrl).toBe('https://new-pic.example.com/alice.jpg');
  });

  it('maps null image to null avatarUrl', () => {
    const result = mapAdapterUserUpdateInput({
      id: 'uuid-1',
      image: null,
    });

    expect(result.avatarUrl).toBeNull();
  });

  it('updates name when provided', () => {
    const result = mapAdapterUserUpdateInput({
      id: 'uuid-1',
      name: 'New Name',
    });

    expect(result.name).toBe('New Name');
  });

  it('does not update name when null (name is required internally)', () => {
    const result = mapAdapterUserUpdateInput({
      id: 'uuid-1',
      name: null,
    });

    expect(result).not.toHaveProperty('name');
  });

  it('does not update name when empty string', () => {
    const result = mapAdapterUserUpdateInput({
      id: 'uuid-1',
      name: '   ',
    });

    expect(result).not.toHaveProperty('name');
  });

  it('does not include status/role/tenant fields', () => {
    const result = mapAdapterUserUpdateInput({
      id: 'uuid-1',
      name: 'Test',
      image: null,
    });

    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('businessId');
    expect(result).not.toHaveProperty('locale');
    expect(result).not.toHaveProperty('id');
  });
});

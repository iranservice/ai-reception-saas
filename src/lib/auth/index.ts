/**
 * Auth.js Adapter Boundary — Public API
 *
 * Re-exports the adapter factory, user mapping utilities, and constants.
 * This module is the single entry point for Auth.js adapter functionality.
 *
 * IMPORTANT: This module must not be imported by:
 * - src/app/** (no runtime auth wiring yet)
 * - src/domains/** (adapter boundary is isolated)
 *
 * @module
 */

export {
  createAuthjsAdapter,
  createUnsupportedDatabaseSessionMethod,
  AUTHJS_DATABASE_SESSIONS_DISABLED_MESSAGE,
  type AuthjsAdapterDB,
} from './authjs-adapter';

export {
  normalizeAuthjsEmail,
  resolveAuthjsDisplayName,
  normalizeAuthjsImage,
  mapInternalUserToAdapterUser,
  mapAdapterUserCreateInput,
  mapAdapterUserUpdateInput,
  AuthjsMappingError,
  type AdapterUserCreatePayload,
  type AdapterUserUpdatePayload,
  type InternalUserForAdapter,
  type InternalUserCreateInput,
  type InternalUserUpdateInput,
  type AdapterUserOutput,
} from './authjs-user-mapping';

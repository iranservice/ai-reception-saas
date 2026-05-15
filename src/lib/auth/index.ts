/**
 * Auth.js Adapter Boundary — Public API
 *
 * Re-exports the adapter factory, user mapping utilities, feature gate,
 * runtime config factory, Prisma DB bridge, route handler factory,
 * and constants.
 * This module is the single entry point for Auth.js adapter functionality.
 *
 * IMPORTANT: Only src/app/api/auth/[...nextauth]/route.ts should
 * import route handler utilities. src/domains/** must not import
 * this module.
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

export {
  AUTHJS_RUNTIME_FEATURE_FLAG,
  isAuthjsRuntimeEnabled,
  assertAuthjsRuntimeEnabled,
  AuthjsRuntimeDisabledError,
} from './authjs-feature-gate';

export {
  createAuthjsConfig,
  tryCreateAuthjsConfig,
  validateAuthjsSecret,
  validateProviders,
  normalizeProviderDescriptor,
  AUTHJS_SESSION_STRATEGY,
  AUTHJS_MISSING_SECRET_MESSAGE,
  AUTHJS_EMPTY_PROVIDERS_WARNING,
  type AuthjsProviderDescriptor,
  type AuthjsRequiredSecrets,
  type AuthjsConfigInput,
  type AuthjsConfigOutput,
} from './authjs-runtime-config';

export {
  createAuthjsAdapterDb,
  type AuthjsPrismaClient,
} from './authjs-prisma-db';

export {
  createAuthjsRouteHandlers,
  createDisabledAuthjsRouteResponse,
  AUTHJS_ROUTE_DISABLED_CODE,
  AUTHJS_ROUTE_DISABLED_MESSAGE,
  AUTHJS_ROUTE_DISABLED_STATUS,
  type AuthjsRouteHandlerInput,
  type AuthjsRouteHandlerOutput,
} from './authjs-route-handlers';

export {
  AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG,
  AUTHJS_GOOGLE_PROVIDER_ID,
  AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE,
  AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE,
  isAuthjsGoogleProviderEnabled,
  validateGoogleProviderCredentials,
  createGoogleAuthProvider,
  createAuthjsProviders,
  type GoogleProviderCredentials,
  type GoogleProviderEnv,
} from './authjs-google-provider';

export {
  getEnabledAuthjsRuntime,
  readAuthjsSession,
  resetAuthjsRuntimeForTests,
  AuthjsSessionReadError,
  type AuthjsRuntimeOutput,
  type AuthjsSessionLike,
} from './authjs-runtime';

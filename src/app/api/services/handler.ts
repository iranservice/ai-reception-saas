// ===========================================================================
// Catalog — API Handler Module
//
// Handler builders for service catalog read operations.
// Uses dependency injection for testability.
// ===========================================================================

import { actionResultToResponse } from '@/app/api/_shared/action-result';
import {
  resolveAuthenticatedRequestContext,
  type AuthenticatedUserRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import {
  parseBooleanQueryParam,
  getSearchParam,
  validateRouteParams,
  uuidParamSchema,
} from '@/app/api/_shared/params';
import type { CatalogService } from '@/domains/catalog/service';

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

/** Dependencies required by the catalog handler module */
export interface CatalogHandlerDeps {
  readonly catalogService: Pick<
    CatalogService,
    'listCategories' | 'listServices' | 'findServiceById'
  >;
  readonly resolveAuthenticatedContext?: (
    request: Request,
  ) => Promise<ContextResult<AuthenticatedUserRequestContext>>;
}

// ---------------------------------------------------------------------------
// Handler builders
// ---------------------------------------------------------------------------

/**
 * Creates a GET /api/services/categories handler.
 *
 * 1. Resolves authenticated request context
 * 2. Returns all active categories
 */
export function createGetCategoriesHandler(
  deps: CatalogHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve =
      deps.resolveAuthenticatedContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const includeInactive = parseBooleanQueryParam(
      getSearchParam(request, 'includeInactive'),
    );

    const result = await deps.catalogService.listCategories({
      includeInactive,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a GET /api/services handler.
 *
 * 1. Resolves authenticated request context
 * 2. Optionally filters by categoryId query param
 * 3. Returns active services
 */
export function createGetServicesHandler(
  deps: CatalogHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve =
      deps.resolveAuthenticatedContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const categoryId = getSearchParam(request, 'categoryId') ?? undefined;
    const includeInactive = parseBooleanQueryParam(
      getSearchParam(request, 'includeInactive'),
    );

    const result = await deps.catalogService.listServices({
      categoryId,
      includeInactive,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a GET /api/services/:serviceId handler.
 *
 * 1. Resolves authenticated request context
 * 2. Validates serviceId route param
 * 3. Returns service detail
 */
export function createGetServiceByIdHandler(
  deps: CatalogHandlerDeps,
): (
  request: Request,
  context: { params: Promise<{ serviceId: string }> },
) => Promise<Response> {
  return async (
    request: Request,
    context: { params: Promise<{ serviceId: string }> },
  ): Promise<Response> => {
    const resolve =
      deps.resolveAuthenticatedContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const params = await context.params;
    const paramResult = validateRouteParams(
      { serviceId: params.serviceId },
      uuidParamSchema('serviceId'),
      'INVALID_CATALOG_INPUT',
      'Invalid service ID',
    );

    if (!paramResult.ok) {
      return paramResult.response;
    }

    const result = await deps.catalogService.findServiceById({
      serviceId: paramResult.data.serviceId,
    });

    return actionResultToResponse(result);
  };
}

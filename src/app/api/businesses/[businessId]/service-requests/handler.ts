// ===========================================================================
// Service Requests — API Handler Module
//
// Handler builders for service request operations.
// Uses dependency injection for testability.
// Context resolution must succeed before any service call.
// Authz must pass before tenant-scoped operations.
// ===========================================================================

import { z } from 'zod';
import {
  actionResultToResponse,
} from '@/app/api/_shared/action-result';
import { validateJsonBody } from '@/app/api/_shared/request';
import {
  validateRouteParams,
  uuidParamSchema,
  getSearchParam,
} from '@/app/api/_shared/params';
import {
  resolveTenantRequestContext,
  type TenantRequestContext,
  type TenantRequestScope,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import type { OrdersService } from '@/domains/orders/service';
import type { AuthzService } from '@/domains/authz/service';
import {
  createServiceRequestInputSchema,
  serviceRequestStatusSchema,
} from '@/domains/orders/validation';

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

/** Dependencies required by the service request handler module */
export interface ServiceRequestHandlerDeps {
  readonly ordersService: Pick<
    OrdersService,
    | 'createServiceRequest'
    | 'listServiceRequests'
    | 'findServiceRequestById'
    | 'updateServiceRequestStatus'
  >;
  readonly authzService: Pick<AuthzService, 'requirePermission'>;
  readonly resolveTenantContext?: (
    request: Request,
    scope?: TenantRequestScope,
  ) => Promise<ContextResult<TenantRequestContext>>;
}

// ---------------------------------------------------------------------------
// Handler builders
// ---------------------------------------------------------------------------

/**
 * Creates a POST /api/businesses/:businessId/service-requests handler.
 *
 * 1. Resolves tenant request context
 * 2. Checks orders.create permission
 * 3. Validates JSON body
 * 4. Calls ordersService.createServiceRequest
 */
export function createPostServiceRequestHandler(
  deps: ServiceRequestHandlerDeps,
): (
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) => Promise<Response> {
  return async (
    request: Request,
    context: { params: Promise<{ businessId: string }> },
  ): Promise<Response> => {
    const params = await context.params;
    const resolve = deps.resolveTenantContext ?? resolveTenantRequestContext;
    const contextResult = await resolve(request, {
      businessId: params.businessId,
      source: 'route-param',
    });

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const authzResult = await deps.authzService.requirePermission({
      userId: contextResult.context.userId,
      businessId: contextResult.context.businessId,
      role: contextResult.context.role,
      permission: 'orders.create',
    });

    if (!authzResult.ok) {
      return actionResultToResponse(authzResult);
    }

    if (!authzResult.data.allowed) {
      return apiError('ACCESS_DENIED', 'Access denied', 403);
    }

    const bodyResult = await validateJsonBody(
      request,
      createServiceRequestInputSchema,
      'INVALID_ORDER_INPUT',
      'Invalid order input',
    );

    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const result = await deps.ordersService.createServiceRequest({
      ...bodyResult.data,
      businessId: contextResult.context.businessId,
      requestedBy: contextResult.context.userId,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a GET /api/businesses/:businessId/service-requests handler.
 *
 * 1. Resolves tenant request context
 * 2. Checks orders.read permission
 * 3. Returns service requests for the business
 */
export function createGetServiceRequestsHandler(
  deps: ServiceRequestHandlerDeps,
): (
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) => Promise<Response> {
  return async (
    request: Request,
    context: { params: Promise<{ businessId: string }> },
  ): Promise<Response> => {
    const params = await context.params;
    const resolve = deps.resolveTenantContext ?? resolveTenantRequestContext;
    const contextResult = await resolve(request, {
      businessId: params.businessId,
      source: 'route-param',
    });

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const authzResult = await deps.authzService.requirePermission({
      userId: contextResult.context.userId,
      businessId: contextResult.context.businessId,
      role: contextResult.context.role,
      permission: 'orders.read',
    });

    if (!authzResult.ok) {
      return actionResultToResponse(authzResult);
    }

    if (!authzResult.data.allowed) {
      return apiError('ACCESS_DENIED', 'Access denied', 403);
    }

    const statusParam = getSearchParam(request, 'status');
    const statusParsed = statusParam
      ? serviceRequestStatusSchema.safeParse(statusParam)
      : null;
    const status = statusParsed?.success ? statusParsed.data : undefined;

    const result = await deps.ordersService.listServiceRequests({
      businessId: contextResult.context.businessId,
      status,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a GET /api/businesses/:businessId/service-requests/:requestId handler.
 *
 * 1. Resolves tenant request context
 * 2. Checks orders.read permission
 * 3. Returns service request detail
 */
export function createGetServiceRequestByIdHandler(
  deps: ServiceRequestHandlerDeps,
): (
  request: Request,
  context: { params: Promise<{ businessId: string; requestId: string }> },
) => Promise<Response> {
  return async (
    request: Request,
    context: {
      params: Promise<{ businessId: string; requestId: string }>;
    },
  ): Promise<Response> => {
    const params = await context.params;
    const resolve = deps.resolveTenantContext ?? resolveTenantRequestContext;
    const contextResult = await resolve(request, {
      businessId: params.businessId,
      source: 'route-param',
    });

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const authzResult = await deps.authzService.requirePermission({
      userId: contextResult.context.userId,
      businessId: contextResult.context.businessId,
      role: contextResult.context.role,
      permission: 'orders.read',
    });

    if (!authzResult.ok) {
      return actionResultToResponse(authzResult);
    }

    if (!authzResult.data.allowed) {
      return apiError('ACCESS_DENIED', 'Access denied', 403);
    }

    const paramResult = validateRouteParams(
      { requestId: params.requestId },
      uuidParamSchema('requestId'),
      'INVALID_ORDER_INPUT',
      'Invalid request ID',
    );

    if (!paramResult.ok) {
      return paramResult.response;
    }

    const result = await deps.ordersService.findServiceRequestById({
      requestId: paramResult.data.requestId,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a PATCH /api/businesses/:businessId/service-requests/:requestId/status handler.
 *
 * 1. Resolves tenant request context
 * 2. Checks orders.update_status permission
 * 3. Validates status in body
 * 4. Calls ordersService.updateServiceRequestStatus
 */
export function createPatchServiceRequestStatusHandler(
  deps: ServiceRequestHandlerDeps,
): (
  request: Request,
  context: { params: Promise<{ businessId: string; requestId: string }> },
) => Promise<Response> {
  return async (
    request: Request,
    context: {
      params: Promise<{ businessId: string; requestId: string }>;
    },
  ): Promise<Response> => {
    const params = await context.params;
    const resolve = deps.resolveTenantContext ?? resolveTenantRequestContext;
    const contextResult = await resolve(request, {
      businessId: params.businessId,
      source: 'route-param',
    });

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const authzResult = await deps.authzService.requirePermission({
      userId: contextResult.context.userId,
      businessId: contextResult.context.businessId,
      role: contextResult.context.role,
      permission: 'orders.update_status',
    });

    if (!authzResult.ok) {
      return actionResultToResponse(authzResult);
    }

    if (!authzResult.data.allowed) {
      return apiError('ACCESS_DENIED', 'Access denied', 403);
    }

    const paramResult = validateRouteParams(
      { requestId: params.requestId },
      uuidParamSchema('requestId'),
      'INVALID_ORDER_INPUT',
      'Invalid request ID',
    );

    if (!paramResult.ok) {
      return paramResult.response;
    }

    const bodyResult = await validateJsonBody(
      request,
      z.object({ status: serviceRequestStatusSchema }).strict(),
      'INVALID_ORDER_INPUT',
      'Invalid order input',
    );

    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const result = await deps.ordersService.updateServiceRequestStatus({
      requestId: paramResult.data.requestId,
      status: bodyResult.data.status,
    });

    return actionResultToResponse(result);
  };
}

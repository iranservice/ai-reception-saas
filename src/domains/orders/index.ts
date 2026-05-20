// ===========================================================================
// Orders Domain — Barrel Exports
// ===========================================================================

export type {
  ServiceRequestIdentity,
  ServiceRequestStatusValue,
  CreateServiceRequestInput,
  FindServiceRequestByIdInput,
  ListServiceRequestsInput,
  UpdateServiceRequestStatusInput,
} from './types';
export {
  SERVICE_REQUEST_STATUS_VALUES,
  SERVICE_REQUEST_TRANSITIONS,
} from './types';

export type { OrdersService, OrdersErrorCode } from './service';
export { ORDERS_ERROR_CODES } from './service';

export type {
  OrdersRepository,
  OrdersRepositoryDb,
} from './repository';
export { createOrdersRepository } from './repository';

export type { OrdersServiceDeps } from './implementation';
export { createOrdersService, generateReferenceNo, isValidTransition } from './implementation';

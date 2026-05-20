// ===========================================================================
// Orders Domain — Repository
//
// Prisma-backed persistence layer for service requests.
// Uses injected Prisma-compatible client for testability.
// ===========================================================================

import { ok, err } from '@/lib/result';
import type { ActionResult } from '@/lib/result';
import type { JsonValue } from '@/lib/types';
import type {
  ServiceRequestIdentity,
  ServiceRequestStatusValue,
  CreateServiceRequestInput,
  FindServiceRequestByIdInput,
  ListServiceRequestsInput,
  UpdateServiceRequestStatusInput,
} from './types';

// ---------------------------------------------------------------------------
// Local record types
// ---------------------------------------------------------------------------

export interface ServiceRequestRecord {
  id: string;
  businessId: string;
  serviceId: string;
  requestedBy: string;
  status: ServiceRequestStatusValue;
  referenceNo: string;
  notes: string | null;
  metadata: JsonValue | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Injected DB client interface
// ---------------------------------------------------------------------------

export interface OrdersRepositoryDb {
  serviceRequest: {
    create(args: {
      data: {
        businessId: string;
        serviceId: string;
        requestedBy: string;
        referenceNo: string;
        notes?: string;
        metadata?: JsonValue;
      };
    }): Promise<ServiceRequestRecord>;
    findUnique(args: {
      where: { id: string };
    }): Promise<ServiceRequestRecord | null>;
    findMany(args: {
      where: { businessId: string; status?: ServiceRequestStatusValue };
      orderBy: { createdAt: 'desc' };
    }): Promise<ServiceRequestRecord[]>;
    update(args: {
      where: { id: string };
      data: Partial<{
        status: ServiceRequestStatusValue;
        completedAt: Date;
        cancelledAt: Date;
      }>;
    }): Promise<ServiceRequestRecord>;
  };
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface OrdersRepository {
  createServiceRequest(
    input: CreateServiceRequestInput & { referenceNo: string },
  ): Promise<ActionResult<ServiceRequestIdentity>>;
  findServiceRequestById(
    input: FindServiceRequestByIdInput,
  ): Promise<ActionResult<ServiceRequestIdentity | null>>;
  listServiceRequests(
    input: ListServiceRequestsInput,
  ): Promise<ActionResult<readonly ServiceRequestIdentity[]>>;
  updateServiceRequestStatus(
    input: UpdateServiceRequestStatusInput,
  ): Promise<ActionResult<ServiceRequestIdentity>>;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapServiceRequestRecord(
  record: ServiceRequestRecord,
): ServiceRequestIdentity {
  return {
    id: record.id,
    businessId: record.businessId,
    serviceId: record.serviceId,
    requestedBy: record.requestedBy,
    status: record.status,
    referenceNo: record.referenceNo,
    notes: record.notes,
    metadata: record.metadata,
    completedAt: record.completedAt
      ? record.completedAt.toISOString()
      : null,
    cancelledAt: record.cancelledAt
      ? record.cancelledAt.toISOString()
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOrdersRepository(
  db: OrdersRepositoryDb,
): OrdersRepository {
  return {
    async createServiceRequest(input) {
      try {
        const record = await db.serviceRequest.create({
          data: {
            businessId: input.businessId,
            serviceId: input.serviceId,
            requestedBy: input.requestedBy,
            referenceNo: input.referenceNo,
            notes: input.notes,
            metadata: input.metadata,
          },
        });
        return ok(mapServiceRequestRecord(record));
      } catch {
        return err(
          'ORDERS_REPOSITORY_ERROR',
          'Orders repository operation failed',
        );
      }
    },

    async findServiceRequestById(input) {
      try {
        const record = await db.serviceRequest.findUnique({
          where: { id: input.requestId },
        });
        return ok(record ? mapServiceRequestRecord(record) : null);
      } catch {
        return err(
          'ORDERS_REPOSITORY_ERROR',
          'Orders repository operation failed',
        );
      }
    },

    async listServiceRequests(input) {
      try {
        const where: {
          businessId: string;
          status?: ServiceRequestStatusValue;
        } = { businessId: input.businessId };
        if (input.status) {
          where.status = input.status;
        }
        const records = await db.serviceRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });
        return ok(records.map(mapServiceRequestRecord));
      } catch {
        return err(
          'ORDERS_REPOSITORY_ERROR',
          'Orders repository operation failed',
        );
      }
    },

    async updateServiceRequestStatus(input) {
      try {
        const data: Partial<{
          status: ServiceRequestStatusValue;
          completedAt: Date;
          cancelledAt: Date;
        }> = { status: input.status };

        if (input.status === 'COMPLETED') {
          data.completedAt = new Date();
        }
        if (input.status === 'CANCELLED') {
          data.cancelledAt = new Date();
        }

        const record = await db.serviceRequest.update({
          where: { id: input.requestId },
          data,
        });
        return ok(mapServiceRequestRecord(record));
      } catch {
        return err(
          'ORDERS_REPOSITORY_ERROR',
          'Orders repository operation failed',
        );
      }
    },
  };
}

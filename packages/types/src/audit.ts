import type { TenantScoped } from './common';

export interface AuditEvent extends TenantScoped {
  actorId: string;
  actorRole: string;       // denormalised at write time so role changes don't rewrite history
  eventType:
    | 'create' | 'update' | 'archive' | 'login' | 'export'
    | 'dds_generate' | 'dds_file' | 'block' | 'unblock' | 'role_change';
  entityType:
    | 'green_lot' | 'roast_batch' | 'sku' | 'order' | 'shipment'
    | 'dds_statement' | 'customer' | 'supplier' | 'producer' | 'user' | 'tenant';
  entityId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  diffSummary: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string;
}
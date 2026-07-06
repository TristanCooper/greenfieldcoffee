import type { TenantScoped } from './common';

export interface StockLevel extends TenantScoped {
  itemKind: 'green' | 'roasted';
  greenLotId: string | null;
  skuId: string | null;
  roastBatchId: string | null;
  locationId: string;
  quantityKg: number;
  reservedKg: number;
  lotIdentifierOverride: string | null;
  expiresOn: string | null;
  updatedAt: string;
}

export interface StockMovement extends TenantScoped {
  itemKind: 'green' | 'roasted';
  greenLotId: string | null;
  skuId: string | null;
  roastBatchId: string | null;
  movementType:
    | 'receive' | 'roast_charge' | 'roast_drop' | 'pick' | 'pack' | 'dispatch' | 'adjust_in' | 'adjust_out';
  quantityKg: number;     // signed: negative for out movements
  locationId: string;
  referenceType: 'green_lot' | 'roast_batch' | 'order' | 'shipment' | 'manual';
  referenceId: string | null;
  occurredAt: string;
  performedBy: string;
  notes: string | null;
}
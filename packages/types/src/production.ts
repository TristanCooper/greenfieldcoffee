import type { TenantScoped } from './common';

export interface RoastBatch extends TenantScoped {
  batchCode: string;
  machine: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  totalChargeWeightKg: number | null;
  totalDropWeightKg: number | null;
  yieldPct: number | null;
  developmentTimePct: number | null;
  sensoryNotes: string | null;
  createdBy: string;
  approvedBy: string | null;
}

export interface RoastBatchInput {
  id: string;
  roastBatchId: string;
  greenLotId: string;
  chargeWeightKg: number;
  createdAt: string;
}

export interface RoastBatchOutput {
  id: string;
  roastBatchId: string;
  skuId: string;
  dropWeightKg: number;
  createdAt: string;
}

export interface Sku extends TenantScoped {
  skuCode: string;
  name: string;
  productType:
    | 'whole_bean_250g' | 'whole_bean_1kg' | 'ground_250g' | 'ground_1kg'
    | 'espresso_250g' | 'filter_250g' | 'custom';
  isSingleOrigin: boolean;
  primaryOriginCountry: string | null;  // ISO-3166-1 alpha-2
  roastProfileTarget: string | null;
  packWeightG: number | null;
  shelfLifeDays: number | null;
  notes: string | null;
}
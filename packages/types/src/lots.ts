import type { IsoCountryCode } from './common';
import type { TenantScoped } from './common';

export interface GreenLot extends TenantScoped {
  lotCode: string;
  supplierId: string;
  producerId: string;
  originCountry: IsoCountryCode;
  harvestYear: number | null;
  harvestStartDate: string | null;
  harvestEndDate: string | null;
  variety: string | null;
  processingMethod: 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other' | null;
  grade: string | null;
  greenWeightKg: number;
  currentWeightKg: number;
  storageLocationId: string | null;
  receivedOn: string;            // ISO date
  expectedDeforestationRisk: 'low' | 'standard' | 'high';
  status: 'received' | 'in_use' | 'depleted' | 'blocked';
  blockedReason: string | null;
  notes: string | null;
}
import type { IsoCountryCode } from './common';
import type { TenantScoped } from './common';

export interface Producer extends TenantScoped {
  name: string;
  countryCode: IsoCountryCode;
  region: string | null;
  fcsOrEstateName: string | null;
  producerType: 'cooperative' | 'estate' | 'smallholder' | 'other';
  latitude: number | null;
  longitude: number | null;
  geolocationSource: 'gps' | 'polygon' | 'centroid' | 'manual' | null;
  geolocationAccuracyM: number | null;
  deforestationRiskClass: 'low' | 'standard' | 'high' | null;
  notes: string | null;
}

export interface Supplier extends TenantScoped {
  name: string;
  countryCode: IsoCountryCode;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  vatOrTaxId: string | null;
  euOperatorOrTrader: boolean;
  notes: string | null;
}

export interface StorageLocation extends TenantScoped {
  name: string;
  kind: 'green_bunker' | 'finished_goods' | 'packaging' | 'other';
  notes: string | null;
}
import type { IsoCountryCode } from './common';
import type { TenantScoped } from './common';

export interface DdsStatement extends TenantScoped {
  referenceNumber: string;
  shipmentId: string;
  operatorName: string;
  operatorAddress: string;
  operatorEoriOrVat: string;
  status: 'draft' | 'ready' | 'filed' | 'rejected';
  filedAt: string | null;
  filedReference: string | null;
  pdfStoragePath: string | null;
  verificationRiskLevel: 'low' | 'standard' | 'high';
  countryOfProduction: IsoCountryCode;
  geolocationPolygonOrPoint: GeolocationPayload;
  producerName: string;
  producerCountry: IsoCountryCode;
  supplierName: string;
  supplierCountry: IsoCountryCode;
  commodityCode: string;     // HS code, default 0901 for coffee
  quantityKg: number;
}

/**
 * EU Due Diligence Statement Annex II geolocation payload.
 * EU spec accepts either a single point or a polygon.
 * Shape kept loose to match what the EU IT system expects; we validate at the edge.
 */
export type GeolocationPayload =
  | { kind: 'point'; latitude: number; longitude: number; accuracyM?: number }
  | { kind: 'polygon'; coordinates: Array<{ latitude: number; longitude: number }> };
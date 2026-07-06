// Core shape shared by every entity that is tenant-scoped.
// Mirrors columns common to most tables in 0001_initial_schema.sql.

export type IsoCountryCode = string; // ISO-3166-1 alpha-2, validated at the edge.
export type IsoCurrencyCode = 'GBP' | 'EUR';

export interface BaseEntity {
  id: string;            // UUID, supplied by DB default gen_random_uuid()
  createdAt: string;     // ISO timestamp
  updatedAt: string;     // ISO timestamp
  archivedAt: string | null;
}

export interface TenantScoped extends BaseEntity {
  tenantId: string;
}

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  countryCode: IsoCountryCode;
}
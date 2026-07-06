import type { Address, IsoCountryCode, IsoCurrencyCode } from './common';
import type { BaseEntity, TenantScoped } from './common';

export interface Customer extends TenantScoped {
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  countryCode: IsoCountryCode;
  vatNumber: string | null;
  notes: string | null;
}

export interface Order extends TenantScoped {
  orderCode: string;
  customerId: string;
  channel: 'manual' | 'web' | 'email' | 'wholesale' | 'subscription';
  status: 'draft' | 'open' | 'allocated' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  destinationCountry: IsoCountryCode;
  requiresDds: boolean;
  requestedDeliveryDate: string | null;
  promisedDeliveryDate: string | null;
  totalValue: number | null;
  currency: IsoCurrencyCode;
  notes: string | null;
}

export interface OrderLine extends BaseEntity {
  orderId: string;
  skuId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderAllocation {
  id: string;
  orderId: string;
  orderLineId: string;
  stockLevelId: string;
  quantityUnits: number;
  createdAt: string;
}

export interface Shipment extends TenantScoped {
  shipmentCode: string;
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  destinationCountry: IsoCountryCode;
  customsDocumentsRequired: boolean;
}

export interface ShipmentLine {
  id: string;
  shipmentId: string;
  stockLevelId: string | null;
  quantityUnits: number;
  grossWeightKg: number;
  createdAt: string;
}
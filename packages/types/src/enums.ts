// Shared enums used across Greenfield Coffee.
// Keep in sync with packages/db/migrations/0001_initial_schema.sql.

export type UserRole = 'owner' | 'roaster' | 'sales' | 'auditor';
export const USER_ROLES: readonly UserRole[] = ['owner', 'roaster', 'sales', 'auditor'] as const;

export type UserStatus = 'invited' | 'active' | 'disabled';
export const USER_STATUSES: readonly UserStatus[] = ['invited', 'active', 'disabled'] as const;

export type EuOperatorType = 'operator' | 'trader';

export type ProducerType = 'cooperative' | 'estate' | 'smallholder' | 'other';
export const PRODUCER_TYPES: readonly ProducerType[] = ['cooperative', 'estate', 'smallholder', 'other'] as const;

export type GeolocationSource = 'gps' | 'polygon' | 'centroid' | 'manual';
export const GEOLOCATION_SOURCES: readonly GeolocationSource[] = ['gps', 'polygon', 'centroid', 'manual'] as const;

export type DeforestationRiskClass = 'low' | 'standard' | 'high';
export const DEFORESTATION_RISK_CLASSES: readonly DeforestationRiskClass[] = ['low', 'standard', 'high'] as const;

export type ProcessingMethod = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other';
export const PROCESSING_METHODS: readonly ProcessingMethod[] = ['washed', 'natural', 'honey', 'anaerobic', 'other'] as const;

export type LotStatus = 'received' | 'in_use' | 'depleted' | 'blocked';
export const LOT_STATUSES: readonly LotStatus[] = ['received', 'in_use', 'depleted', 'blocked'] as const;

export type StorageLocationKind = 'green_bunker' | 'finished_goods' | 'packaging' | 'other';
export const STORAGE_LOCATION_KINDS: readonly StorageLocationKind[] = ['green_bunker', 'finished_goods', 'packaging', 'other'] as const;

export type RoastBatchStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export const ROAST_BATCH_STATUSES: readonly RoastBatchStatus[] = ['planned', 'in_progress', 'completed', 'cancelled'] as const;

export type SkuProductType =
  | 'whole_bean_250g'
  | 'whole_bean_1kg'
  | 'ground_250g'
  | 'ground_1kg'
  | 'espresso_250g'
  | 'filter_250g'
  | 'custom';
export const SKU_PRODUCT_TYPES: readonly SkuProductType[] = [
  'whole_bean_250g', 'whole_bean_1kg', 'ground_250g', 'ground_1kg',
  'espresso_250g', 'filter_250g', 'custom',
] as const;

export type OrderChannel = 'manual' | 'web' | 'email' | 'wholesale' | 'subscription';
export const ORDER_CHANNELS: readonly OrderChannel[] = ['manual', 'web', 'email', 'wholesale', 'subscription'] as const;

export type OrderStatus = 'draft' | 'open' | 'allocated' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'draft', 'open', 'allocated', 'picking', 'packed', 'shipped', 'delivered', 'cancelled',
] as const;

export type StockItemKind = 'green' | 'roasted';
export const STOCK_ITEM_KINDS: readonly StockItemKind[] = ['green', 'roasted'] as const;

export type StockMovementType =
  | 'receive' | 'roast_charge' | 'roast_drop' | 'pick' | 'pack' | 'dispatch' | 'adjust_in' | 'adjust_out';
export const STOCK_MOVEMENT_TYPES: readonly StockMovementType[] = [
  'receive', 'roast_charge', 'roast_drop', 'pick', 'pack', 'dispatch', 'adjust_in', 'adjust_out',
] as const;

export type StockMovementReference = 'green_lot' | 'roast_batch' | 'order' | 'shipment' | 'manual';
export const STOCK_MOVEMENT_REFERENCES: readonly StockMovementReference[] = [
  'green_lot', 'roast_batch', 'order', 'shipment', 'manual',
] as const;

export type DdsStatus = 'draft' | 'ready' | 'filed' | 'rejected';
export const DDS_STATUSES: readonly DdsStatus[] = ['draft', 'ready', 'filed', 'rejected'] as const;

export type AuditEventType =
  | 'create' | 'update' | 'archive' | 'login' | 'export'
  | 'dds_generate' | 'dds_file' | 'block' | 'unblock' | 'role_change';
export const AUDIT_EVENT_TYPES: readonly AuditEventType[] = [
  'create', 'update', 'archive', 'login', 'export',
  'dds_generate', 'dds_file', 'block', 'unblock', 'role_change',
] as const;

export type AuditEntityType =
  | 'green_lot' | 'roast_batch' | 'sku' | 'order' | 'shipment'
  | 'dds_statement' | 'customer' | 'supplier' | 'producer' | 'user' | 'tenant';
export const AUDIT_ENTITY_TYPES: readonly AuditEntityType[] = [
  'green_lot', 'roast_batch', 'sku', 'order', 'shipment',
  'dds_statement', 'customer', 'supplier', 'producer', 'user', 'tenant',
] as const;

export type CurrencyCode = 'GBP' | 'EUR';
export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ['GBP', 'EUR'] as const;
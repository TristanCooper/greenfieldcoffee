import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeforestationRiskClass,
  GeolocationSource,
  IsoCountryCode,
  ProcessingMethod,
  ProducerType,
} from '@greenfield/types';
import { writeAuditEvent } from './audit';
import { findOrCreateProducer } from './producers';
import { findOrCreateSupplier, findOrCreateGreenBunker } from './suppliers';

/**
 * Receive a new green lot.
 *
 * Atomicity caveat: supabase-js runs each statement as a separate RPC,
 * not a transaction. We do our best by writing in dependency order and
 * letting later failures leave earlier writes visible — the user can
 * see and fix partial intakes from the dashboard, and the audit log
 * records what actually happened.
 *
 * If you need strict transactional atomicity, wrap this in a Postgres
 * function called via .rpc(). Out of scope for Phase 0.
 *
 * Side effects, in order:
 *   1. Find or create supplier
 *   2. Find or create producer (with geolocation + deforestation risk)
 *   3. Find or create the default 'green bunker' storage location
 *   4. Generate the lot code (tenant-aware)
 *   5. Insert green_lots row
 *   6. Insert stock_levels row (kind='green', quantity = received weight)
 *   7. Insert stock_movements row (movement_type='receive')
 *   8. Write audit_events for lot + stock movement
 *
 * Returns the created lot row plus the supplier/producer/location ids.
 */
export interface ReceiveGreenLotInput {
  supplierName: string;
  supplierCountryCode: IsoCountryCode;
  producerName: string;
  producerCountryCode: IsoCountryCode;
  producerRegion?: string | null;
  producerType: ProducerType;
  producerLatitude: number | null;
  producerLongitude: number | null;
  geolocationSource: GeolocationSource;
  geolocationAccuracyM: number | null;
  deforestationRiskClass: DeforestationRiskClass;
  variety: string | null;
  processingMethod: ProcessingMethod | null;
  grade: string | null;
  greenWeightKg: number;
  receivedOn: string;            // ISO date
  notes?: string | null;
}

export interface ReceiveGreenLotResult {
  lotId: string;
  lotCode: string;
  supplierId: string;
  producerId: string;
  storageLocationId: string;
  stockLevelId: string;
  stockMovementId: string;
}

interface LotCodeContext {
  supabase: SupabaseClient;
  tenantId: string;
  date: Date;
  originCountry: string;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate a tenant-unique lot code of the form
 *   {ORIGIN}-{YYYY-MM-DD}-{SEQ}
 * where SEQ is the next integer for this tenant + date + origin. We pick
 * this scheme so codes sort chronologically and never collide within a day.
 */
async function nextLotCode(ctx: LotCodeContext, varietyOrProcess: string | null): Promise<string> {
  const dateStr = formatDate(ctx.date);
  const tag = (varietyOrProcess ?? 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GEN';
  const prefix = `${ctx.originCountry}-${dateStr}-${tag}`;

  // Count existing lots for this tenant whose lot_code starts with the prefix,
  // and add 1. RLS ensures we only count within the current tenant.
  const { count, error } = await ctx.supabase
    .from('green_lots')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)
    .like('lot_code', `${prefix}-%`);
  if (error) {
    throw new Error(`Could not compute next lot code: ${error.message}`);
  }
  const seq = (count ?? 0) + 1;
  return `${prefix}-${String(seq).padStart(2, '0')}`;
}

export async function receiveGreenLot(
  supabase: SupabaseClient,
  actorId: string,
  actorRole: string,
  tenantId: string,
  input: ReceiveGreenLotInput,
): Promise<ReceiveGreenLotResult> {
  if (input.greenWeightKg <= 0) {
    throw new Error('Green weight must be greater than zero.');
  }
  if (input.producerLatitude !== null && input.producerLongitude === null) {
    throw new Error('Producer latitude and longitude must be set together.');
  }
  if (input.producerLongitude !== null && input.producerLatitude === null) {
    throw new Error('Producer latitude and longitude must be set together.');
  }

  // 1. Supplier
  const supplier = await findOrCreateSupplier(supabase, tenantId, {
    name: input.supplierName,
    countryCode: input.supplierCountryCode,
  });

  // 2. Producer (carries EUDR data)
  const producer = await findOrCreateProducer(supabase, tenantId, {
    name: input.producerName,
    countryCode: input.producerCountryCode,
    region: input.producerRegion ?? null,
    producerType: input.producerType,
    latitude: input.producerLatitude,
    longitude: input.producerLongitude,
    geolocationSource: input.geolocationSource,
    geolocationAccuracyM: input.geolocationAccuracyM,
    deforestationRiskClass: input.deforestationRiskClass,
  });

  // 3. Default storage location (green bunker)
  const location = await findOrCreateGreenBunker(supabase, tenantId);

  // 4. Lot code
  const receivedDate = new Date(input.receivedOn);
  if (Number.isNaN(receivedDate.getTime())) {
    throw new Error('receivedOn must be a valid ISO date.');
  }
  const lotCode = await nextLotCode(
    { supabase, tenantId, date: receivedDate, originCountry: input.producerCountryCode },
    input.variety ?? input.processingMethod,
  );

  // 5. Insert the green_lots row
  const lotInsert = await supabase
    .from('green_lots')
    .insert({
      tenant_id: tenantId,
      lot_code: lotCode,
      supplier_id: supplier.id,
      producer_id: producer.id,
      origin_country: input.producerCountryCode,
      harvest_year: null,
      harvest_start_date: null,
      harvest_end_date: null,
      variety: input.variety,
      processing_method: input.processingMethod,
      grade: input.grade,
      green_weight_kg: input.greenWeightKg,
      current_weight_kg: input.greenWeightKg,
      storage_location_id: location.id,
      received_on: input.receivedOn,
      expected_deforestation_risk: input.deforestationRiskClass,
      status: 'received',
      blocked_reason: null,
      notes: input.notes ?? null,
    })
    .select(
      'id, tenant_id, lot_code, supplier_id, producer_id, origin_country, ' +
        'green_weight_kg, current_weight_kg, status, received_on, created_at',
    )
    .single();

  if (lotInsert.error || !lotInsert.data) {
    throw new Error(
      lotInsert.error?.message ?? 'Could not create green lot.',
    );
  }
  const lot = lotInsert.data as unknown as {
    id: string;
    lot_code: string;
  };

  // 6. Stock level row
  const stockInsert = await supabase
    .from('stock_levels')
    .insert({
      tenant_id: tenantId,
      item_kind: 'green',
      green_lot_id: lot.id,
      sku_id: null,
      roast_batch_id: null,
      location_id: location.id,
      quantity_kg: input.greenWeightKg,
      reserved_kg: 0,
      lot_identifier_override: null,
      expires_on: null,
    })
    .select('id')
    .single();

  if (stockInsert.error || !stockInsert.data) {
    throw new Error(
      stockInsert.error?.message ?? 'Could not create stock level.',
    );
  }
  const stockLevelId = (stockInsert.data as { id: string }).id;

  // 7. Stock movement (the receipt)
  const movementInsert = await supabase
    .from('stock_movements')
    .insert({
      tenant_id: tenantId,
      item_kind: 'green',
      green_lot_id: lot.id,
      sku_id: null,
      roast_batch_id: null,
      movement_type: 'receive',
      quantity_kg: input.greenWeightKg,
      location_id: location.id,
      reference_type: 'green_lot',
      reference_id: lot.id,
      occurred_at: new Date().toISOString(),
      performed_by: actorId,
      notes: null,
    })
    .select('id')
    .single();

  if (movementInsert.error || !movementInsert.data) {
    throw new Error(
      movementInsert.error?.message ?? 'Could not record stock movement.',
    );
  }
  const stockMovementId = (movementInsert.data as { id: string }).id;

  // 8. Audit events (non-fatal if they fail)
  await writeAuditEvent({
    supabase,
    tenantId,
    actorId,
    actorRole,
    eventType: 'create',
    entityType: 'green_lot',
    entityId: lot.id,
    afterState: {
      lot_code: lot.lot_code,
      supplier_id: supplier.id,
      producer_id: producer.id,
      origin_country: input.producerCountryCode,
      green_weight_kg: input.greenWeightKg,
      expected_deforestation_risk: input.deforestationRiskClass,
      status: 'received',
    },
    diffSummary: `Received ${input.greenWeightKg}kg as ${lot.lot_code}`,
  });

  await writeAuditEvent({
    supabase,
    tenantId,
    actorId,
    actorRole,
    eventType: 'create',
    entityType: 'green_lot',
    entityId: stockMovementId,
    afterState: {
      movement_type: 'receive',
      quantity_kg: input.greenWeightKg,
      green_lot_id: lot.id,
    },
    diffSummary: `Stock receive ${input.greenWeightKg}kg for ${lot.lot_code}`,
  });

  return {
    lotId: lot.id,
    lotCode: lot.lot_code,
    supplierId: supplier.id,
    producerId: producer.id,
    storageLocationId: location.id,
    stockLevelId,
    stockMovementId,
  };
}
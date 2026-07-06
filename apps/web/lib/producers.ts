import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeforestationRiskClass,
  GeolocationSource,
  IsoCountryCode,
  ProducerType,
} from '@greenfield/types';

/**
 * Find a producer by (name, country) within the current tenant, or create
 * one. Producers carry the EUDR-relevant data: geolocation, producer type,
 * deforestation risk class.
 *
 * For Phase 0 we treat (name, country) as a natural key. Two producers
 * with the same name in different countries are different producers —
 * makes sense in the coffee world (Kona in Hawaii vs Kona in Papua New
 * Guinea).
 */
export interface Producer {
  id: string;
  tenant_id: string;
  name: string;
  country_code: string;
  region: string | null;
  producer_type: ProducerType;
  latitude: number | null;
  longitude: number | null;
  geolocation_source: GeolocationSource | null;
  geolocation_accuracy_m: number | null;
  deforestation_risk_class: DeforestationRiskClass | null;
  created_at: string;
}

export interface ProducerFields {
  name: string;
  countryCode: IsoCountryCode;
  region?: string | null;
  producerType: ProducerType;
  latitude: number | null;
  longitude: number | null;
  geolocationSource: GeolocationSource;
  geolocationAccuracyM: number | null;
  deforestationRiskClass: DeforestationRiskClass;
}

export async function findOrCreateProducer(
  supabase: SupabaseClient,
  tenantId: string,
  fields: ProducerFields,
): Promise<Producer> {
  const name = fields.name.trim();
  if (!name) throw new Error('Producer name is required.');
  if (fields.countryCode.length !== 2) {
    throw new Error('Producer country must be a 2-letter ISO code.');
  }
  if (fields.latitude !== null && (fields.latitude < -90 || fields.latitude > 90)) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (fields.longitude !== null && (fields.longitude < -180 || fields.longitude > 180)) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  const existing = await supabase
    .from('producers')
    .select(
      'id, tenant_id, name, country_code, region, producer_type, ' +
        'latitude, longitude, geolocation_source, geolocation_accuracy_m, ' +
        'deforestation_risk_class, created_at',
    )
    .eq('tenant_id', tenantId)
    .eq('name', name)
    .eq('country_code', fields.countryCode)
    .is('archived_at', null)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Producer lookup failed: ${existing.error.message}`);
  }
  if (existing.data) return existing.data as unknown as Producer;

  const created = await supabase
    .from('producers')
    .insert({
      tenant_id: tenantId,
      name,
      country_code: fields.countryCode,
      region: fields.region ?? null,
      producer_type: fields.producerType,
      latitude: fields.latitude,
      longitude: fields.longitude,
      geolocation_source: fields.latitude !== null ? fields.geolocationSource : null,
      geolocation_accuracy_m: fields.latitude !== null ? fields.geolocationAccuracyM : null,
      deforestation_risk_class: fields.deforestationRiskClass,
    })
    .select(
      'id, tenant_id, name, country_code, region, producer_type, ' +
        'latitude, longitude, geolocation_source, geolocation_accuracy_m, ' +
        'deforestation_risk_class, created_at',
    )
    .single();

  if (created.error || !created.data) {
    throw new Error(
      created.error?.message ?? 'Could not create producer.',
    );
  }
  return created.data as unknown as Producer;
}
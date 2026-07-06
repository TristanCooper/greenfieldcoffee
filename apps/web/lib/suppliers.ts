import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Find a supplier by (name, country) within the current tenant, or create
 * one if no match exists. Used by the receive-green wizard when the user
 * enters a supplier we haven't seen before.
 *
 * Returns the supplier row (existing or newly created). Tenant-scoped via
 * the RLS policies on public.suppliers; the caller must use the per-user
 * (not service-role) client so the tenant_id claim is enforced.
 *
 * The caller must pass tenantId — we always set it explicitly on insert
 * rather than relying on a database default, because RLS rejects inserts
 * where tenant_id doesn't match current_tenant_id().
 */
export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  country_code: string;
  created_at: string;
}

export async function findOrCreateSupplier(
  supabase: SupabaseClient,
  tenantId: string,
  fields: { name: string; countryCode: string },
): Promise<Supplier> {
  const name = fields.name.trim();
  const countryCode = fields.countryCode.toUpperCase();
  if (!name) throw new Error('Supplier name is required.');
  if (countryCode.length !== 2) throw new Error('Supplier country must be a 2-letter ISO code.');

  const existing = await supabase
    .from('suppliers')
    .select('id, tenant_id, name, country_code, created_at')
    .eq('tenant_id', tenantId)
    .eq('name', name)
    .eq('country_code', countryCode)
    .is('archived_at', null)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Supplier lookup failed: ${existing.error.message}`);
  }
  if (existing.data) return existing.data as unknown as Supplier;

  const created = await supabase
    .from('suppliers')
    .insert({ tenant_id: tenantId, name, country_code: countryCode })
    .select('id, tenant_id, name, country_code, created_at')
    .single();

  if (created.error || !created.data) {
    throw new Error(
      created.error?.message ?? 'Could not create supplier.',
    );
  }
  return created.data as unknown as Supplier;
}

/**
 * Find or create a storage location of kind 'green_bunker'. Used as the
 * default destination when receiving green coffee.
 */
export async function findOrCreateGreenBunker(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ id: string }> {
  const existing = await supabase
    .from('storage_locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('kind', 'green_bunker')
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Storage location lookup failed: ${existing.error.message}`);
  }
  if (existing.data) return existing.data as { id: string };

  const created = await supabase
    .from('storage_locations')
    .insert({ tenant_id: tenantId, name: 'Green bunker', kind: 'green_bunker' })
    .select('id')
    .single();

  if (created.error || !created.data) {
    throw new Error(
      created.error?.message ?? 'Could not create green bunker.',
    );
  }
  return created.data as { id: string };
}
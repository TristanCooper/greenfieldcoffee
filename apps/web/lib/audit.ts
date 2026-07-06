import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuditEntityType,
  AuditEventType,
} from '@greenfield/types';

/**
 * Insert a row into public.audit_events.
 *
 * Audit events are append-only — the table has triggers that block UPDATE
 * and DELETE. The RLS policy allows INSERT for any tenant member, so this
 * works for both service-role and per-user clients. Callers should pass the
 * tenant-scoped client (i.e. NOT the service-role bypass) when possible so
 * the actor_id reflects the actual user. Use the service-role client only
 * for system-initiated events.
 *
 * `beforeState` / `afterState` are free-form jsonb snapshots of the row
 * at the moment of change. `diffSummary` is a short human-readable line
 * that shows up in audit-log views.
 */
export interface WriteAuditEvent {
  supabase: SupabaseClient;
  tenantId: string;
  actorId: string | null;
  actorRole: string;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  diffSummary?: string | null;
}

export async function writeAuditEvent(input: WriteAuditEvent): Promise<void> {
  const { supabase, tenantId, ...row } = input;
  const { error } = await supabase.from('audit_events').insert({
    tenant_id: tenantId,
    actor_id: row.actorId,
    actor_role: row.actorRole,
    event_type: row.eventType,
    entity_type: row.entityType,
    entity_id: row.entityId,
    before_state: row.beforeState ?? null,
    after_state: row.afterState ?? null,
    diff_summary: row.diffSummary ?? null,
  });
  if (error) {
    // Audit failures are non-fatal but should be loud. Throwing would
    // break the surrounding transaction; logging is the right balance.
    console.error('[audit] failed to write event:', error.message, {
      tenantId,
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: row.entityId,
    });
  }
}
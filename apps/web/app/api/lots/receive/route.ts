import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { requireSupabaseEnv } from '@/lib/supabase/env';
import { receiveGreenLot } from '@/lib/lots';

const IsoCountry = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Must be a 2-letter ISO country code');

const Body = z.object({
  supplierName: z.string().min(1).max(120),
  supplierCountryCode: IsoCountry,
  producerName: z.string().min(1).max(120),
  producerCountryCode: IsoCountry,
  producerRegion: z.string().max(120).optional().nullable(),
  producerType: z.enum(['cooperative', 'estate', 'smallholder', 'other']),
  producerLatitude: z.number().min(-90).max(90).nullable(),
  producerLongitude: z.number().min(-180).max(180).nullable(),
  geolocationSource: z.enum(['gps', 'polygon', 'centroid', 'manual']),
  geolocationAccuracyM: z.number().min(0).max(100000).nullable(),
  deforestationRiskClass: z.enum(['low', 'standard', 'high']),
  variety: z.string().max(120).nullable(),
  processingMethod: z.enum(['washed', 'natural', 'honey', 'anaerobic', 'other']).nullable(),
  grade: z.string().max(60).nullable(),
  greenWeightKg: z.number().positive().max(100000),
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * POST /api/lots/receive
 *
 * Receives a new green lot. Caller must be authenticated; the user's
 * tenant_id (read from app_metadata) is the tenant scope for everything
 * written. The RLS policies on green_lots / suppliers / producers /
 * stock_levels / stock_movements / audit_events all enforce tenant
 * isolation via current_tenant_id().
 *
 * We use the per-user server client (RLS enforced) rather than the
 * service-role bypass so the audit trail reflects who actually performed
 * the action.
 */
export async function POST(request: NextRequest) {
  let payload: z.infer<typeof Body>;
  try {
    const json = await request.json();
    payload = Body.parse(json);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // requireSupabaseEnv throws if env is missing; we only need the call to
  // fail fast before we touch the database.
  try {
    requireSupabaseEnv();
  } catch (err) {
    console.error('[receive-green] missing Supabase env vars:', err);
    return NextResponse.json(
      { error: 'Server is missing Supabase configuration.' },
      { status: 500 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id;
  if (!tenantId) {
    console.error('[receive-green] user has no tenant_id in app_metadata', user.id);
    return NextResponse.json(
      { error: 'Account is not associated with a roastery. Contact support.' },
      { status: 403 },
    );
  }

  const supabase = await createClient();

  const role =
    (user.user_metadata as { role?: string } | undefined)?.role ??
    (user.app_metadata as { role?: string } | undefined)?.role ??
    'owner';

  try {
    const result = await receiveGreenLot(supabase, user.id, role, tenantId, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    console.error('[receive-green] failed:', message);
    // Validation-style errors → 400; anything else → 500.
    const status = /required|must be|greater than|valid/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
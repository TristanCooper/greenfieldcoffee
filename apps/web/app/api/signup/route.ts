import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const Body = z.object({
  roasteryName: z.string().min(1).max(120),
  countryCode: z.string().length(2),
  currency: z.enum(['GBP', 'EUR']),
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

/**
 * POST /api/signup
 *
 * Creates a tenant + owner user atomically:
 *   1. Create Supabase Auth user (service-role)
 *   2. Insert tenant (service-role, bypasses RLS)
 *   3. Set tenant_id on auth user's app_metadata
 *   4. Insert public.users row for the owner
 *   5. Sign in via the SSR client so auth cookies are set on the response
 *
 * Each step has a rollback path so partial signups don't leave orphans.
 *
 * Error handling: every Supabase admin call is wrapped in try/catch so that
 * network errors (fetch failed, DNS, timeouts) become a structured 502 with
 * a useful message rather than Next.js's bare "fetch failed" passthrough.
 * The full error is logged server-side for debugging.
 */

/**
 * True when the error message looks like a network/transport failure rather
 * than an application-level rejection. We match by string because Node's
 * fetch wraps transport errors as TypeError but the Supabase JS client may
 * catch the throw and surface it as a returned { error: { message } } object.
 */
function looksLikeNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('etimedout') ||
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('socket hang up')
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export async function POST(request: NextRequest) {
  // 0. Validate the request body.
  let parsed: z.infer<typeof Body>;
  try {
    const json = await request.json();
    parsed = Body.parse(json);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Server-side configuration check.
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!serviceRole || !supabaseUrl || !anonKey) {
    console.error('[signup] missing Supabase env vars');
    return NextResponse.json(
      { error: 'Server is missing Supabase configuration. Contact support.' },
      { status: 500 },
    );
  }

  // Admin client — service-role key, bypasses RLS.
  const admin = createAdminClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Helper: wrap a Supabase call so network/auth errors become structured responses.
  async function adminStep<T>(
    label: string,
    fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  ): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
    try {
      const { data, error } = await fn();
      if (error) {
        console.error(`[signup] ${label} returned error:`, error.message);
        if (looksLikeNetworkError(error.message)) {
          return {
            ok: false,
            response: NextResponse.json(
              {
                error:
                  'Could not reach the authentication service. Please try again in a moment.',
              },
              { status: 502 },
            ),
          };
        }
        return {
          ok: false,
          response: NextResponse.json(
            { error: `${label}: ${error.message}` },
            { status: 400 },
          ),
        };
      }
      if (data === null) {
        console.error(`[signup] ${label} returned no data`);
        return {
          ok: false,
          response: NextResponse.json(
            { error: `${label} returned no data.` },
            { status: 500 },
          ),
        };
      }
      return { ok: true, data };
    } catch (err) {
      console.error(`[signup] ${label} threw:`, err);
      if (looksLikeNetworkError(errorMessage(err))) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              error:
                'Could not reach the authentication service. Please try again in a moment.',
            },
            { status: 502 },
          ),
        };
      }
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Unexpected server error. Please try again.' },
          { status: 500 },
        ),
      };
    }
  }

  // 1. Create the Supabase Auth user.
  const userStep = await adminStep('create_user', () =>
    admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.fullName },
    }).then((r) => ({ data: r.data.user, error: r.error })),
  );
  if (!userStep.ok) return userStep.response;
  const authUserId = userStep.data.id;

  // 2. Create the tenant.
  const tenantStep = await adminStep('create_tenant', async () => {
    const r = await admin
      .from('tenants')
      .insert({
        name: parsed.roasteryName,
        country_code: parsed.countryCode,
        default_currency: parsed.currency,
      })
      .select('id')
      .single();
    return { data: r.data, error: r.error };
  });
  if (!tenantStep.ok) {
    await safeDelete(() => admin.auth.admin.deleteUser(authUserId));
    return tenantStep.response;
  }
  const tenantId = tenantStep.data.id;

  // 3. Add tenant_id to the auth user's app_metadata so RLS picks it up.
  const updateStep = await adminStep('set_tenant_metadata', () =>
    admin.auth.admin
      .updateUserById(authUserId, { app_metadata: { tenant_id: tenantId } })
      .then((r) => ({ data: r.data as unknown, error: r.error })),
  );
  if (!updateStep.ok) {
    await safeDelete(() => admin.from('tenants').delete().eq('id', tenantId));
    await safeDelete(() => admin.auth.admin.deleteUser(authUserId));
    return updateStep.response;
  }

  // 4. Create the public.users row for this person.
  const usersStep = await adminStep('create_user_row', async () => {
    const r = await admin.from('users').insert({
      id: authUserId,
      tenant_id: tenantId,
      email: parsed.email,
      full_name: parsed.fullName,
      role: 'owner',
      status: 'active',
    });
    return { data: r.data as unknown, error: r.error };
  });
  if (!usersStep.ok) {
    await safeDelete(() => admin.from('tenants').delete().eq('id', tenantId));
    await safeDelete(() => admin.auth.admin.deleteUser(authUserId));
    return usersStep.response;
  }

  // 5. Sign the user in via the SSR client so cookies are set on the response.
  try {
    const response = NextResponse.json({ ok: true, tenantId });
    const ssr = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    const { error: signInError } = await ssr.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });
    if (signInError) {
      console.error('[signup] sign_in failed:', signInError.message);
      return NextResponse.json(
        {
          error:
            'Your account was created but we could not sign you in automatically. Please use the sign-in page.',
        },
        { status: 500 },
      );
    }
    return response;
  } catch (err) {
    console.error('[signup] sign_in threw:', err);
    if (looksLikeNetworkError(errorMessage(err))) {
      return NextResponse.json(
        {
          error:
            'Your account was created but sign-in is temporarily unavailable. Please use the sign-in page.',
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

/**
 * Best-effort rollback helper. Logs failures but does not throw — we're
 * already in an error path and a failed cleanup shouldn't mask the original.
 * Wraps the builder in `.then(() => undefined)` so the result is a real Promise
 * regardless of what the Supabase client returns.
 */
async function safeDelete(fn: () => unknown): Promise<void> {
  try {
    await Promise.resolve(fn());
  } catch (err) {
    console.error('[signup] rollback failed:', err);
  }
}
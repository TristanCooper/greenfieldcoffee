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
 */
export async function POST(request: NextRequest) {
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

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!serviceRole || !supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: 'Server is missing Supabase configuration.' },
      { status: 500 },
    );
  }

  // Admin client — service-role key, bypasses RLS.
  const admin = createAdminClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Create the Supabase Auth user.
  const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.fullName },
  });

  if (signUpError || !authData.user) {
    return NextResponse.json(
      { error: signUpError?.message ?? 'Could not create user.' },
      { status: 400 },
    );
  }

  const authUserId = authData.user.id;

  // 2. Create the tenant.
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({
      name: parsed.roasteryName,
      country_code: parsed.countryCode,
      default_currency: parsed.currency,
    })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { error: tenantError?.message ?? 'Could not create tenant.' },
      { status: 400 },
    );
  }

  // 3. Add tenant_id to the auth user's app_metadata so RLS picks it up.
  const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: { tenant_id: tenant.id },
  });

  if (updateError) {
    await admin.from('tenants').delete().eq('id', tenant.id);
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // 4. Create the public.users row for this person.
  const { error: usersError } = await admin.from('users').insert({
    id: authUserId,
    tenant_id: tenant.id,
    email: parsed.email,
    full_name: parsed.fullName,
    role: 'owner',
    status: 'active',
  });

  if (usersError) {
    await admin.from('tenants').delete().eq('id', tenant.id);
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: usersError.message }, { status: 400 });
  }

  // 5. Sign the user in via the SSR client so cookies are set on the response.
  const response = NextResponse.json({ ok: true, tenantId: tenant.id });
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
    return NextResponse.json({ error: signInError.message }, { status: 400 });
  }

  return response;
}
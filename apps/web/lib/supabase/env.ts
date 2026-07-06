/**
 * Resolve Supabase env vars with friendly fallbacks.
 *
 * Supabase historically named its env vars `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
 * `SUPABASE_SERVICE_ROLE_KEY`. Next.js convention for browser-exposed values is
 * to prefix them `NEXT_PUBLIC_`. We're migrating to:
 *   - sb_publishable_xxx keys (was anon) — safe in browser
 *   - sb_secret_xxx keys (was service_role) — server-only
 * The actual *values* change, not the env var names. This helper accepts the
 * values from any of the common locations and reports exactly what's missing.
 */
export function getSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    '';
  return { url, anonKey, serviceRoleKey };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  const missing: string[] = [];
  if (!env.url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!env.anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!env.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase configuration: ${missing.join(', ')}. ` +
        `Add these to .env.local. See .env.example for the full list.`,
    );
  }
  return env;
}
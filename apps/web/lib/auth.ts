import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { createClient } from './supabase/server';

/**
 * Returns the currently authenticated Supabase user, or null.
 * Reads from the auth cookie via the server client.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Server-component / server-action helper: require an authenticated user.
 * Redirects to /login (preserving the next param) if no user.
 */
export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const target = nextPath
      ? (`/login?next=${encodeURIComponent(nextPath)}` as Route)
      : ('/login' as Route);
    redirect(target);
  }
  return user;
}

/**
 * Returns the active tenant id from the user's JWT app_metadata.
 * Returns null if the user has no tenant assigned yet (e.g. mid-signup).
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id;
  return tenantId ?? null;
}
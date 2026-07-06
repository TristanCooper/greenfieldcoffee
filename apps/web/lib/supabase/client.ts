import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

/**
 * Browser-side Supabase client.
 *
 * Throws a clear error if the publishable key (formerly anon) is missing
 * rather than the cryptic "URL and Key required" the underlying client throws.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error(
      'Supabase browser client cannot start: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from .env.local. ' +
        'Get them from Settings → API Keys in your Supabase dashboard.',
    );
  }
  return createBrowserClient(url, anonKey);
}
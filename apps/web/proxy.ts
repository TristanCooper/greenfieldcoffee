import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

/**
 * Next.js 16 renamed the middleware file convention from `middleware.ts` to
 * `proxy.ts`. The function it exports is also called `proxy` now. Functionally
 * identical: refresh Supabase auth cookies on every request and gate routes.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - any file with an extension (e.g. .png, .svg, .css, .js)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
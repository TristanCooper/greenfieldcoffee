import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware client. Used to refresh the Supabase auth session on every
 * request so RLS-protected queries always see a valid token.
 *
 * Public routes pass through; protected routes redirect to /login when
 * the user has no session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser.
  // A simple mistake could make it very hard to debug issues with users
  // being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/accept-invite');
  const isDashboard = pathname.startsWith('/dashboard');
  const isMarketing = pathname === '/';

  if (isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/dashboard') {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user && !pathname.startsWith('/accept-invite')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  void isMarketing;

  return response;
}
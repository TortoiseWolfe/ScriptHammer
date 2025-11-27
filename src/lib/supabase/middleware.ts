/**
 * Supabase Middleware Helpers
 *
 * Session validation and cookie management for Next.js middleware.
 * Used to protect routes and refresh authentication tokens.
 *
 * @module lib/supabase/middleware
 */

import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/supabase/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('lib:supabase:middleware');

/**
 * Updates Supabase session in middleware
 *
 * Validates and refreshes authentication tokens in middleware layer.
 * Automatically refreshes expired tokens before they become invalid.
 *
 * @param request - Next.js request object
 * @returns NextResponse with updated session cookies
 *
 * @example
 * ```ts
 * // In middleware.ts
 * import { updateSession } from '@/lib/supabase/middleware';
 *
 * export async function middleware(request: NextRequest) {
 *   return await updateSession(request);
 * }
 * ```
 */
export async function updateSession(request: NextRequest) {
  // Create a response to modify
  const supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error(
      'Missing Supabase environment variables in middleware. Authentication will not work.'
    );
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Get user session (this will also refresh expired tokens)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect auth routes - redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname === '/sign-in' ||
      request.nextUrl.pathname === '/sign-up')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/profile';
    return NextResponse.redirect(url);
  }

  // Protect authenticated routes - redirect unauthenticated users to sign-in
  const protectedRoutes = [
    '/profile',
    '/account',
    '/payment-demo', // Payment page requires authentication
  ];

  if (
    !user &&
    protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    // Store the original URL to redirect back after sign-in
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse;
}

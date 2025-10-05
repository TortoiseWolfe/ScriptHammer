/**
 * Next.js Middleware for Authentication
 *
 * Protects routes and refreshes authentication sessions.
 * Runs on every request to check auth status.
 *
 * @module middleware
 */

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware function
 *
 * Automatically validates and refreshes authentication sessions.
 * Redirects unauthenticated users away from protected routes.
 * Redirects authenticated users away from auth pages.
 *
 * @param request - Next.js request object
 * @returns NextResponse with updated session cookies or redirects
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Middleware configuration
 *
 * Defines which routes the middleware should run on.
 * Excludes static assets, API routes (except auth), and Next.js internals.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     * - api routes (except /api/auth/*)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

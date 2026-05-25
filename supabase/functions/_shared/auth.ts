/**
 * Shared auth helper for outbound payment Edge Functions.
 *
 * Extracts the caller's user_id from the Supabase JWT in the
 * Authorization header. Every outbound payment function must verify
 * the caller owns the payment_intent / subscription row it's acting on,
 * because the service-role client bypasses RLS.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Raised when the request has no Authorization header, the JWT is
 * malformed, or the JWT is invalid / expired.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Verify the request's Supabase JWT and return the authenticated
 * user_id. Throws UnauthorizedError if absent or invalid.
 *
 * Uses the anon key to validate the JWT — verifying the signature does
 * not require service-role privileges. The caller can then use the
 * returned user_id to do ownership checks via the service-role client.
 */
export async function getAuthenticatedUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    throw new UnauthorizedError('Empty Authorization token');
  }

  const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing in function env'
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new UnauthorizedError(error?.message ?? 'JWT verification failed');
  }

  return data.user.id;
}

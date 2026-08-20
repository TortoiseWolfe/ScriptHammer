/**
 * delete-account Edge Function
 *
 * Permanently deletes the CALLING user's account: the `auth.users` row, and via
 * `ON DELETE CASCADE`, their profile and everything hanging off it.
 *
 * Fixes #859. Before this, deletion was attempted from the browser as
 * `.from('user_profiles').delete().eq('id', user.id)`. Two independent reasons that
 * could never work:
 *
 *   1. `user_profiles` has RLS enabled with policies for INSERT, SELECT and UPDATE and
 *      NO DELETE policy. RLS filtered the statement to zero rows and returned NO error,
 *      so the client read it as success, signed the user out and told them their account
 *      was permanently deleted. Nothing was deleted.
 *
 *   2. Even had it worked, it deletes the wrong end of the relationship.
 *      `user_profiles_id_fkey` has child `user_profiles` and parent `auth.users`, so the
 *      cascade runs auth.users -> user_profiles. Removing a profile row cannot remove an
 *      account, and a browser client cannot touch `auth.users` at all — that needs the
 *      service role, which must never reach the browser.
 *
 * REQUEST
 *   POST /functions/v1/delete-account
 *   Authorization: Bearer <user JWT>
 *   Body: none. Deliberately.
 *
 * RESPONSE
 *   200 OK: { success: true }
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   500 Internal Server Error: { error: string }
 *
 * SECURITY MODEL
 *   - The account to delete is taken ONLY from the verified JWT. There is no user_id
 *     parameter and there must never be one: this endpoint holds the service role, so a
 *     caller-supplied id would let any authenticated user delete anyone.
 *   - The JWT is verified with the anon key (see _shared/auth.ts) before the service-role
 *     client is constructed.
 *   - `admin.deleteUser` is the only privileged call, and it is scoped to that id.
 *   - Deletion is verified after the fact rather than trusted. The bug this replaces was
 *     precisely a delete that reported success while doing nothing, so reporting success
 *     without confirming it would repeat the defect in a new place.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  let userId: string;
  try {
    userId = await getAuthenticatedUserId(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Auth check failed' },
      500
    );
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return jsonResponse(
      req,
      { error: `Failed to delete account: ${deleteError.message}` },
      500
    );
  }

  // Confirm rather than assume. #859 was a deletion that returned no error and removed
  // nothing; a success response that has not been checked is the same failure wearing a
  // different status code.
  const { data: stillThere } = await admin.auth.admin.getUserById(userId);
  if (stillThere?.user) {
    return jsonResponse(
      req,
      { error: 'Account deletion reported success but the user still exists' },
      500
    );
  }

  return jsonResponse(req, { success: true });
});

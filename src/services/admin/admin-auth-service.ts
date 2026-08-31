'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminProfile {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
}

export class AdminAuthService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async checkIsAdmin(userId: string): Promise<boolean> {
    // #240: single source of truth. Call the is_admin() RPC (which reads the
    // user_profiles.is_admin column live, SECURITY DEFINER) rather than reading
    // the column directly. This is the SAME authority the RLS policies and admin
    // RPCs now gate on, so the UI gate and the admin data can never disagree
    // ("hollow admin"), and revoking the column takes effect immediately on the
    // next request without waiting for a token refresh ("lingering admin").
    // BARE, so the question matches the one the data layer asks (#1029).
    //
    // This passed `check_user_id: userId`, and the comment above claimed that was
    // "the SAME authority the RLS policies and admin RPCs now gate on". It was
    // not. Those call `is_admin()` with no argument, which resolves the
    // function's `DEFAULT auth.uid()` — "am I an admin?". Passing an id asks a
    // different question: "is this user an admin?", which `is_admin(uuid)` is
    // SECURITY DEFINER and EXECUTE-able by `anon`, so anyone can ask about anyone.
    //
    // The two disagreeing is the "hollow admin" this comment says it prevents,
    // inverted: the UI gate opened while every admin RPC refused with 403, so the
    // panel rendered with no data and nothing said why.
    //
    // `userId` is kept in the signature: callers pass the user they mean, and a
    // future non-self check should be a DIFFERENT method rather than this one
    // quietly answering a question the caller did not ask.
    void userId;
    const { data, error } = await this.supabase.rpc('is_admin');

    if (error) return false;
    return data === true;
  }
}

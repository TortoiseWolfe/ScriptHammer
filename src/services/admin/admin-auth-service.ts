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
    const { data, error } = await this.supabase.rpc('is_admin', {
      check_user_id: userId,
    });

    if (error) return false;
    return data === true;
  }
}

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
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error || !data) return false;
    return (data as { is_admin?: boolean }).is_admin === true;
  }
}

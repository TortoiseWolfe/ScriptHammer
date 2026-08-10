import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkUsernameAvailable, validateUsername } from './validation';

describe('profile username validation', () => {
  it('accepts the profile username contract while keeping an empty handle optional', () => {
    expect(validateUsername('')).toEqual({ valid: true });
    expect(validateUsername('testuser-b')).toEqual({ valid: true });
    expect(validateUsername('a'.repeat(30))).toEqual({ valid: true });
    expect(validateUsername('a'.repeat(31))).toMatchObject({ valid: false });
    expect(validateUsername('not allowed')).toMatchObject({ valid: false });
  });

  it('checks the trimmed, canonical username while excluding the current user', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const neq = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ neq });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as SupabaseClient;

    await expect(
      checkUsernameAvailable(supabase, '  Existing_User  ', 'current-user')
    ).resolves.toBe(true);

    expect(eq).toHaveBeenCalledWith('username', 'existing_user');
    expect(neq).toHaveBeenCalledWith('id', 'current-user');
  });
});

/**
 * Supabase Client Configuration
 * Singleton instance for frontend usage
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseConfig, validateSupabaseConfig } from '@/config/payment';

// Validate configuration at module load
if (typeof window !== 'undefined') {
  try {
    validateSupabaseConfig();
  } catch (error) {
    console.error('Supabase configuration error:', error);
    throw error;
  }
}

// Check if localStorage is available
function canUseLocalStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Supabase client instance
 * - Configured for frontend use with anon key
 * - Persistent sessions enabled (if localStorage available)
 * - Real-time subscriptions configured
 */
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      persistSession: canUseLocalStorage(),
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-client-info': 'scripthammer-payment-integration',
      },
    },
  }
);

/**
 * Helper: Check if Supabase is accessible
 * @returns Promise<boolean> - true if connected
 */
export async function isSupabaseOnline(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('payment_intents')
      .select('id')
      .limit(1);
    return !error || error.code !== 'PGRST301'; // PGRST301 = connection error
  } catch {
    return false;
  }
}

/**
 * Helper: Subscribe to connection status changes
 * @param callback - Called when connection status changes
 * @returns Unsubscribe function
 */
export function onConnectionChange(
  callback: (online: boolean) => void
): () => void {
  let isOnline = true;

  const checkConnection = async () => {
    const online = await isSupabaseOnline();
    if (online !== isOnline) {
      isOnline = online;
      callback(online);
    }
  };

  // Check every 30 seconds
  const interval = setInterval(checkConnection, 30000);

  // Initial check
  checkConnection();

  // Return unsubscribe function
  return () => clearInterval(interval);
}

'use client';

/**
 * Auth Context
 * Global authentication state management with React Context
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import IdleTimeoutModal from '@/components/molecular/IdleTimeoutModal';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showIdleModal, setShowIdleModal] = useState(false);

  // Session idle timeout (24 hours = 1440 minutes)
  const { timeRemaining, resetTimer } = useIdleTimeout({
    timeoutMinutes: 1440,
    warningMinutes: 1,
    onWarning: () => {
      if (user) {
        setShowIdleModal(true);
      }
    },
    onTimeout: () => {
      if (user) {
        signOut();
      }
    },
  });

  useEffect(() => {
    console.log('[AuthContext] Initializing auth...');

    // Fallback timeout - prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn(
        '[AuthContext] Auth loading timeout (5s) - forcing isLoading to false'
      );
      console.warn(
        '[AuthContext] This suggests Supabase client is not responding'
      );
      setIsLoading(false);
    }, 5000);

    // Get initial session
    console.log('[AuthContext] Calling supabase.auth.getSession()...');
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(loadingTimeout);
        console.log('[AuthContext] getSession() resolved successfully');
        console.log('[AuthContext] Session:', session ? 'Active' : 'None');
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      })
      .catch((error) => {
        clearTimeout(loadingTimeout);
        console.error('[AuthContext] getSession() failed with error:', error);
        console.error('[AuthContext] Error type:', error?.constructor?.name);
        console.error('[AuthContext] Error message:', error?.message);
        setIsLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Auto-generate encryption keys on first login
      if (session?.user && _event === 'SIGNED_IN') {
        try {
          const { keyManagementService } = await import(
            '@/services/messaging/key-service'
          );
          const hasKeys = await keyManagementService.hasValidKeys();
          if (!hasKeys) {
            console.log('Initializing encryption keys...');
            await keyManagementService.initializeKeys();
            console.log('Encryption keys initialized successfully');
          }
        } catch (error) {
          console.error('Failed to initialize encryption keys:', error);
          // Don't break auth flow if key generation fails
        }
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const refreshSession = async () => {
    const { data } = await supabase.auth.refreshSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    refreshSession,
  };

  const handleContinueSession = () => {
    setShowIdleModal(false);
    resetTimer();
  };

  const handleSignOutNow = () => {
    setShowIdleModal(false);
    signOut();
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <IdleTimeoutModal
        isOpen={showIdleModal}
        timeRemaining={timeRemaining}
        onContinue={handleContinueSession}
        onSignOut={handleSignOutNow}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

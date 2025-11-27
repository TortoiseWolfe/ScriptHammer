'use client';

/**
 * Auth Context
 * Global authentication state management with React Context
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { retryWithBackoff } from '@/lib/auth/retry-utils';
import { createLogger } from '@/lib/logger';
import IdleTimeoutModal from '@/components/molecular/IdleTimeoutModal';

const logger = createLogger('contexts:auth');

/**
 * Auth error types for user feedback
 */
export interface AuthError {
  code: 'TIMEOUT' | 'NETWORK' | 'AUTH_FAILED' | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

/**
 * Auth error messages for consistent user feedback
 */
export const AUTH_ERROR_MESSAGES: Record<AuthError['code'], string> = {
  TIMEOUT: 'Authentication taking longer than expected',
  NETWORK: 'Unable to connect. Check your internet connection.',
  AUTH_FAILED: 'Sign in failed. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
  retryCount: number;
}

export interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  retry: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showIdleModal, setShowIdleModal] = useState(false);
  const isLocalSignOut = useRef(false);

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
    // Fallback timeout - prevent infinite loading (FR-001)
    // Must be longer than retry delays (1s + 2s + 4s = 7s) to allow retries to complete
    const loadingTimeout = setTimeout(() => {
      logger.warn('Auth loading timeout - setting error state');
      setError({
        code: 'TIMEOUT',
        message: AUTH_ERROR_MESSAGES.TIMEOUT,
        retryable: true,
      });
      setIsLoading(false);
    }, 10000);

    // Get initial session with retry logic (FR-007)
    const getSessionWithRetry = async () => {
      try {
        const {
          data: { session },
        } = await retryWithBackoff(
          () =>
            supabase.auth.getSession().then((res) => {
              if (res.error) throw res.error;
              return res;
            }),
          3, // maxRetries
          [1000, 2000, 4000] // exponential backoff delays
        );
        clearTimeout(loadingTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        clearTimeout(loadingTimeout);
        logger.error('Failed to get session after retries', { error: err });
        setError({
          code: 'AUTH_FAILED',
          message: AUTH_ERROR_MESSAGES.AUTH_FAILED,
          retryable: true,
        });
        setIsLoading(false);
      }
    };

    getSessionWithRetry();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // FR-009: Cross-tab sign-out detection
      if (_event === 'SIGNED_OUT' && !isLocalSignOut.current) {
        // Sign-out detected from another tab - redirect to home
        logger.info('Cross-tab sign-out detected, redirecting to home');
        window.location.href = '/';
        return;
      }

      // Reset local sign-out flag after handling and clear encryption keys
      if (_event === 'SIGNED_OUT') {
        isLocalSignOut.current = false;
        // Clear encryption keys from memory on logout
        try {
          const { keyManagementService } = await import(
            '@/services/messaging/key-service'
          );
          keyManagementService.clearKeys();
        } catch (error) {
          logger.error('Failed to clear encryption keys', { error });
        }
      }

      // Note: Encryption keys are now derived in SignInForm.handleSubmit()
      // with the user's password. No auto-init here.
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
    // Mark as local sign-out to prevent double redirect from onAuthStateChange
    isLocalSignOut.current = true;

    // FR-004: Clear local state FIRST (fail-safe)
    setUser(null);
    setSession(null);
    setError(null);

    // Then attempt Supabase signOut (don't await, don't throw)
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Log but don't throw - local state already cleared
      logger.error('Supabase signOut failed (local state cleared)', {
        error: err,
      });
    }

    // FR-005: Force page reload to clear any stale React state
    window.location.href = '/';
  };

  const refreshSession = async () => {
    const { data } = await supabase.auth.refreshSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
  };

  const retry = async () => {
    setError(null);
    setRetryCount((prev) => prev + 1);
    setIsLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
    } catch (err) {
      logger.error('Retry failed', { error: err });
      setError({
        code: 'AUTH_FAILED',
        message: AUTH_ERROR_MESSAGES.AUTH_FAILED,
        retryable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    error,
    retryCount,
    signUp,
    signIn,
    signOut,
    refreshSession,
    retry,
    clearError,
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

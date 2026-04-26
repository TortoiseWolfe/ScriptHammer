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
  useCallback,
  useMemo,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, setAllowAuthTokenRemoval } from '@/lib/supabase/client';
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

  // Mirror current `user` into a ref so the idle-timeout callbacks below can
  // read its latest value without depending on it. Inline arrow callbacks
  // get fresh closures each render but useIdleTimeout holds the very first
  // pair in its effect deps — without this ref the callbacks would read the
  // user value from the render that registered them, meaning a user who
  // signs in after mount never gets auto-signed-out by the idle timer.
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Stable callbacks for useIdleTimeout — without useCallback, every render
  // would feed new identities into the hook and force its effect to tear
  // down + re-register all window listeners (mousedown/keydown/touchstart/
  // scroll), accumulating thousands of duplicates over a 24h session.
  const handleIdleWarning = useCallback(() => {
    if (userRef.current) setShowIdleModal(true);
  }, []);

  // Forward declaration via ref — signOut is defined below but the warning
  // callback above only fires after first render, by which time signOutRef
  // has been populated.
  const signOutRef = useRef<() => Promise<void>>(async () => {});
  const handleIdleTimeout = useCallback(() => {
    if (userRef.current) signOutRef.current();
  }, []);

  // Session idle timeout (24 hours = 1440 minutes)
  const { timeRemaining, resetTimer } = useIdleTimeout({
    timeoutMinutes: 1440,
    warningMinutes: 1,
    onWarning: handleIdleWarning,
    onTimeout: handleIdleTimeout,
  });

  useEffect(() => {
    // Diagnostic helper — gated on E2E flag, no-op in production.
    const e2eDiag = (msg: string, data: Record<string, unknown> = {}) => {
      if (
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('playwright_e2e') === 'true'
      ) {
        try {
          console.warn(`[AUTH-DIAG] ${msg}`, JSON.stringify(data));
        } catch {
          /* JSON.stringify can fail on circular refs; ignore */
        }
      }
    };

    // Fallback timeout - prevent infinite loading (FR-001)
    // Must be longer than retry delays (1s + 2s + 4s = 7s) to allow retries to complete
    const loadingTimeout = setTimeout(() => {
      logger.warn('Auth loading timeout - setting error state');
      e2eDiag('loading-timeout-fired', { hadUser: !!userRef.current });
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
        e2eDiag('getSession-resolved', {
          hasSession: !!session,
          userId: session?.user?.id?.slice(0, 8),
        });
        setSession(session);
        setUser(session?.user ?? null);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        clearTimeout(loadingTimeout);
        e2eDiag('getSession-failed', {
          errMsg: String(err).slice(0, 200),
        });
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
      e2eDiag('onAuthStateChange', {
        event: _event,
        hasSession: !!session,
        userId: session?.user?.id?.slice(0, 8),
      });
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // FR-009: Cross-tab sign-out detection
      if (_event === 'SIGNED_OUT' && !isLocalSignOut.current) {
        // Skip cross-tab redirect in E2E test mode to prevent test contamination.
        // Concurrent tests sign out independently; without this guard, one test's
        // sign-out fires SIGNED_OUT in every other test's page, redirecting to '/'.
        const isE2ETest =
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('playwright_e2e') === 'true';
        if (!isE2ETest) {
          // Sign-out detected from another tab - redirect to home
          logger.info('Cross-tab sign-out detected, redirecting to home');
          window.location.href = '/';
          return;
        }
        logger.info('Cross-tab sign-out detected but suppressed in E2E mode');
      }

      // Reset local sign-out flag after handling and clear encryption keys
      // Reset local sign-out flag after handling and clear encryption keys
      if (_event === 'SIGNED_OUT') {
        const isE2ETest =
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('playwright_e2e') === 'true';
        // In E2E mode, only clear keys on intentional sign-out.
        // Spurious SIGNED_OUT from 406/403 errors must NOT clear keys —
        // resetEncryptionKeys handles key resets via page.reload() instead.
        const shouldClearKeys = isLocalSignOut.current || !isE2ETest;
        e2eDiag('SIGNED_OUT-clearKeys-decision', {
          isLocalSignOut: isLocalSignOut.current,
          isE2ETest,
          shouldClearKeys,
        });
        isLocalSignOut.current = false;
        if (shouldClearKeys) {
          try {
            const { keyManagementService } = await import(
              '@/services/messaging/key-service'
            );
            keyManagementService.clearKeys();
          } catch (error) {
            logger.error('Failed to clear encryption keys', { error });
          }
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

  const signUp = useCallback(async (email: string, password: string) => {
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
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    // Mark as local sign-out to prevent double redirect from onAuthStateChange
    isLocalSignOut.current = true;

    // FR-004: Clear local state FIRST (fail-safe)
    setUser(null);
    setSession(null);
    setError(null);

    // Allow the E2E storage adapter to remove auth tokens during sign-out
    setAllowAuthTokenRemoval(true);

    // Then attempt Supabase signOut (don't await, don't throw)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      // Log but don't throw - local state already cleared
      logger.error('Supabase signOut failed (local state cleared)', {
        error: err,
      });
    } finally {
      setAllowAuthTokenRemoval(false);
    }

    // FR-005: Force page reload to clear any stale React state
    window.location.href = '/';
  }, []);

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.refreshSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
  }, []);

  const retry = useCallback(async () => {
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
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Keep signOutRef in sync so the idle-timeout callback above can call the
  // current signOut without depending on it (which would invalidate the
  // useIdleTimeout effect on every render).
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  // Memoize the context value so consumers don't re-render on every
  // AuthProvider render. Without this, retryCount/error/isLoading changes
  // cascade re-renders to every subtree (ConversationView, payment, etc.).
  // ConsentContext does this correctly; copy that pattern here.
  const value = useMemo<AuthContextType>(
    () => ({
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
    }),
    [
      user,
      session,
      isLoading,
      error,
      retryCount,
      signUp,
      signIn,
      signOut,
      refreshSession,
      retry,
      clearError,
    ]
  );

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

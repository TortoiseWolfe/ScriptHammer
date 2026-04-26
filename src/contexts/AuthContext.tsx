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
 * Check whether a Supabase auth-token in localStorage is still valid
 * (parseable JSON with a non-expired access_token).
 *
 * Used to distinguish a SPURIOUS SIGNED_OUT (Supabase fired the event due
 * to a transient 401/406 from Realtime / RLS, but the auth-token is still
 * good — recovery happens on the next TOKEN_REFRESHED) from a REAL
 * sign-out (cross-tab signout cleared the token, or refresh-token was
 * revoked, or expires_at has passed).
 *
 * Returns false on: missing token, JSON parse error, missing expires_at,
 * or expires_at <= now (with a small grace window).
 *
 * Safe to call from event handlers — synchronous, no I/O beyond reading
 * localStorage.
 */
function isAuthTokenValidInLocalStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!key) return false;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      access_token?: string;
      expires_at?: number;
    };
    if (!parsed?.access_token || typeof parsed.expires_at !== 'number') {
      return false;
    }
    // expires_at is a UNIX timestamp in seconds; allow 60-second grace
    // so we don't treat a token within its last minute as "still valid"
    // (the next API call would 401 anyway).
    const nowSec = Math.floor(Date.now() / 1000);
    return parsed.expires_at > nowSec + 60;
  } catch {
    return false;
  }
}

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
      // Spurious SIGNED_OUT detection. Supabase fires SIGNED_OUT on
      // transient 401/406 errors from Realtime / RLS, even when the user
      // is still authenticated and the auth-token in localStorage is
      // still valid. The next TOKEN_REFRESHED / SIGNED_IN event recovers
      // automatically. If we ran setUser(null) on the spurious event,
      // every consumer (useConversationList, EncryptionKeyGate, navbar)
      // would see user=null and flicker — same UX wart in production
      // and in E2E. So we distinguish: real signout vs transient hiccup.
      //
      // Heuristic: SIGNED_OUT fired without isLocalSignOut.current AND
      // the auth-token JSON in localStorage still parses to a non-expired
      // access_token → it's spurious; ignore. Otherwise it's real
      // (cross-tab signout, refresh-token revoked, token expired) →
      // proceed with state clearing.
      if (_event === 'SIGNED_OUT' && !isLocalSignOut.current) {
        const tokenStillValid = isAuthTokenValidInLocalStorage();
        if (tokenStillValid) {
          logger.info(
            'Spurious SIGNED_OUT suppressed (auth-token still valid in localStorage)'
          );
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // FR-009: real cross-tab sign-out — redirect to home.
      // Reaching this branch means: SIGNED_OUT fired AND it's not a local
      // sign-out AND the auth-token is gone/expired (we cleared it in
      // another tab, or the refresh token was revoked server-side).
      if (_event === 'SIGNED_OUT' && !isLocalSignOut.current) {
        logger.info('Cross-tab sign-out detected, redirecting to home');
        window.location.href = '/';
        return;
      }

      // Local sign-out path — clear encryption keys.
      if (_event === 'SIGNED_OUT') {
        isLocalSignOut.current = false;
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

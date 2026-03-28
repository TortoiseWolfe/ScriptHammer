'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { ReAuthModal } from '@/components/auth/ReAuthModal';
import { keyManagementService } from '@/services/messaging/key-service';
import { useAuth } from '@/contexts/AuthContext';

export interface EncryptionKeyGateProps {
  /** Child content — rendered once keys are confirmed in memory */
  children: ReactNode;
}

/**
 * EncryptionKeyGate — blocks children until E2E encryption keys are usable.
 *
 * Three possible states on mount:
 *  1. No keys in database → redirect to /messages/setup (full-page form so
 *     password manager can fill). Children never render.
 *  2. Keys in database but not in memory → show ReAuthModal to unlock.
 *     Children render behind the modal (they'll fail to decrypt until unlock
 *     but the layout mounts — avoids re-mount flash on success).
 *  3. Keys in memory → children render immediately.
 *
 * Waits for the auth session to be restored before checking keys.
 * Without this, getUser() returns "Auth session missing!" on static
 * exports where localStorage session restoration is asynchronous.
 *
 * @category auth
 */
export default function EncryptionKeyGate({
  children,
}: EncryptionKeyGateProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [checkingKeys, setCheckingKeys] = useState(true);
  const [needsReAuth, setNeedsReAuth] = useState(false);

  // Track if user was ever authenticated. Supabase token refresh briefly
  // sets user=null and removes the auth token from localStorage. Without
  // this guard, the gate would redirect to /sign-in during refresh.
  const wasAuthenticatedRef = useRef(false);
  if (user) {
    wasAuthenticatedRef.current = true;
  }

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Don't redirect to /sign-in here — MessagingGate handles that.
      // Redirecting from EncryptionKeyGate during Supabase token refresh
      // (when user is transiently null) destroys the active conversation.
      // Just wait for the auth context to restore the user.
      return;
    }

    const checkKeys = async () => {
      // Pass user.id directly — avoids getSession()/getUser() race condition.
      // The auth context already confirmed the user exists (isLoading=false,
      // user≠null), so we can skip the auth check inside hasKeys().
      let hasStoredKeys = false;
      try {
        hasStoredKeys = await keyManagementService.hasKeysForUser(user!.id);
      } catch (err) {
        console.error('[EncryptionKeyGate] hasKeysForUser() threw:', err);
      }

      if (!hasStoredKeys) {
        // No keys at all — first-run setup. Full page redirect (not modal)
        // so the browser's password manager sees a real form.
        router.push('/messages/setup');
        return;
      }

      // Keys exist in DB. Are they in memory or localStorage cache?
      // Try restoring from localStorage first (covers page reload / storageState).
      await keyManagementService.restoreKeysFromCache();
      const keys = keyManagementService.getCurrentKeys();
      if (!keys) {
        setNeedsReAuth(true);
      }
      setCheckingKeys(false);
    };
    checkKeys();
  }, [router, authLoading, user]);

  const handleReAuthSuccess = useCallback(() => {
    setNeedsReAuth(false);
  }, []);

  // Always render children — blocking them behind a spinner prevented
  // the sidebar tabs from mounting, which broke E2E tests that wait for
  // the "Connections" tab while the gate is still checking keys.
  // Show a loading overlay on top instead of replacing children entirely.
  return (
    <>
      {(authLoading || checkingKeys) && (
        <div
          className="bg-base-100/80 pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          data-testid="encryption-key-gate-loading"
        >
          <span
            className="loading loading-spinner loading-lg"
            role="status"
            aria-label="Checking encryption keys"
          ></span>
        </div>
      )}
      <ReAuthModal isOpen={needsReAuth} onSuccess={handleReAuthSuccess} />
      {children}
    </>
  );
}

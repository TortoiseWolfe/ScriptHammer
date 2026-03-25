'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
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

  useEffect(() => {
    // Wait for auth context to finish loading before checking keys.
    // On static exports, the Supabase session restores from localStorage
    // asynchronously — calling getUser() before this completes returns
    // "Auth session missing!" which falsely redirects to /messages/setup.
    if (authLoading) return;

    if (!user) {
      // Not authenticated — redirect to sign-in
      router.push('/sign-in?redirect=/messages');
      return;
    }

    const checkKeys = async () => {
      let hasStoredKeys = false;
      try {
        hasStoredKeys = await keyManagementService.hasKeys();
      } catch (err) {
        console.error('[EncryptionKeyGate] hasKeys() threw:', err);
      }

      if (!hasStoredKeys) {
        // No keys at all — first-run setup. Full page redirect (not modal)
        // so the browser's password manager sees a real form.
        router.push('/messages/setup');
        return;
      }

      // Keys exist in DB. Are they in memory this session?
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

  if (authLoading || checkingKeys) {
    return (
      <div
        className="fixed inset-x-0 top-16 bottom-28 flex items-center justify-center"
        data-testid="encryption-key-gate-loading"
      >
        <span
          className="loading loading-spinner loading-lg"
          role="status"
          aria-label="Checking encryption keys"
        ></span>
      </div>
    );
  }

  return (
    <>
      <ReAuthModal isOpen={needsReAuth} onSuccess={handleReAuthSuccess} />
      {children}
    </>
  );
}

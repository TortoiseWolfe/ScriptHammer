'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessagingGate } from '@/components/auth/MessagingGate';
import { EncryptionKeyGate } from '@/components/auth/EncryptionKeyGate';
import ConversationView from '@/components/organisms/ConversationView';
import MessagesSidebar from '@/components/organisms/MessagesSidebar';
import EmptyConversationPrompt from '@/components/molecular/EmptyConversationPrompt';
import SetupCompleteToast from '@/components/molecular/SetupCompleteToast';

/**
 * Inner component that uses useSearchParams (requires Suspense).
 * All UI state lives in the parent (MessagesLayout) and is passed
 * in as props — so Suspense remounts of this component don't lose state.
 */
function MessagesInner({
  conversationId,
  onConversationIdFromUrl,
  isMobileDrawerOpen,
  onConversationSelect,
  onToggleDrawer,
}: {
  conversationId: string | null;
  onConversationIdFromUrl: (id: string | null) => void;
  isMobileDrawerOpen: boolean;
  onConversationSelect: (convId: string) => void;
  onToggleDrawer: () => void;
}) {
  const searchParams = useSearchParams();

  // Sync URL params to parent state on mount and URL changes
  useEffect(() => {
    const urlConvId = searchParams?.get('conversation') ?? null;
    onConversationIdFromUrl(urlConvId);
  }, [searchParams, onConversationIdFromUrl]);

  return (
    <>
      <SetupCompleteToast />

      <div className="bg-base-100 fixed inset-x-0 top-16 bottom-28 overflow-hidden">
        <div className="drawer md:drawer-open h-full">
          <input
            id="sidebar-drawer"
            type="checkbox"
            className="drawer-toggle"
            checked={isMobileDrawerOpen}
            onChange={onToggleDrawer}
          />

          <div className="drawer-content flex h-full flex-col overflow-hidden md:ml-80 lg:ml-96">
            {/* Mobile-only hamburger bar */}
            <div className="navbar bg-base-100 border-base-300 shrink-0 border-b md:hidden">
              <div className="flex-none">
                <label
                  htmlFor="sidebar-drawer"
                  className="btn btn-square btn-ghost min-h-11 min-w-11"
                  aria-label="Open sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block h-5 w-5 stroke-current"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </label>
              </div>
              <div className="flex-1">
                <span className="text-lg font-semibold">Messages</span>
              </div>
            </div>

            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {conversationId ? (
                <ConversationView conversationId={conversationId} />
              ) : (
                <EmptyConversationPrompt onOpenSidebar={onToggleDrawer} />
              )}
            </main>
          </div>

          <div className="drawer-side z-40">
            <label
              htmlFor="sidebar-drawer"
              aria-label="Close sidebar"
              className="drawer-overlay"
            />
            <MessagesSidebar
              selectedConversationId={conversationId}
              onConversationSelect={onConversationSelect}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * State holder that lives OUTSIDE Suspense. Survives Suspense remounts.
 * ConversationView renders here via props passed through MessagesInner,
 * but the conversationId state is owned here — not inside the Suspense tree.
 */
function MessagesLayout() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(true);

  // Called by MessagesInner when URL params sync
  const handleUrlConversationId = useCallback(
    (urlConvId: string | null) => {
      if (!initialized) {
        setConversationId(urlConvId);
        setInitialized(true);
        if (urlConvId) setIsMobileDrawerOpen(false);
      } else if (urlConvId !== null && urlConvId !== conversationId) {
        // External URL change (back/forward)
        setConversationId(urlConvId);
      }
    },
    [initialized, conversationId]
  );

  // Auto-close drawer when conversation becomes active
  useEffect(() => {
    if (conversationId) setIsMobileDrawerOpen(false);
  }, [conversationId]);

  const handleConversationSelect = useCallback((convId: string) => {
    setConversationId(convId);
    setIsMobileDrawerOpen(false);
    // Update URL for deep linking
    const params = new URLSearchParams(window.location.search);
    params.set('conversation', convId);
    params.set('tab', 'chats');
    window.history.pushState({}, '', `/messages?${params.toString()}`);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsMobileDrawerOpen((prev) => !prev);
  }, []);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <MessagesInner
        conversationId={conversationId}
        onConversationIdFromUrl={handleUrlConversationId}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onConversationSelect={handleConversationSelect}
        onToggleDrawer={toggleDrawer}
      />
    </Suspense>
  );
}

/**
 * Messages page entry point.
 *
 * Architecture (from outside in):
 * 1. MessagingGate — blocks if not authenticated
 * 2. EncryptionKeyGate — blocks if keys not available
 * 3. MessagesLayout — owns conversationId state (OUTSIDE Suspense)
 * 4. Suspense — wraps MessagesInner (uses useSearchParams)
 * 5. MessagesInner — UI rendering + URL sync
 *
 * conversationId state survives Suspense remounts because it lives
 * in MessagesLayout (step 3), not MessagesInner (step 5).
 */
export default function MessagesPage() {
  return (
    <MessagingGate>
      <EncryptionKeyGate>
        <MessagesLayout />
      </EncryptionKeyGate>
    </MessagingGate>
  );
}

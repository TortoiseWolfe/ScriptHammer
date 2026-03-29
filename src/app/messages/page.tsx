'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { MessagingGate } from '@/components/auth/MessagingGate';
import { EncryptionKeyGate } from '@/components/auth/EncryptionKeyGate';
import ConversationView from '@/components/organisms/ConversationView';
import MessagesSidebar from '@/components/organisms/MessagesSidebar';
import EmptyConversationPrompt from '@/components/molecular/EmptyConversationPrompt';
import SetupCompleteToast from '@/components/molecular/SetupCompleteToast';
import SearchParamsReader from './SearchParamsReader';

/**
 * Messages page layout — owns ALL state, renders ALL UI.
 * SearchParamsReader (uses useSearchParams) is a renderless child
 * that syncs URL params to this component's state.
 *
 * Even though this whole component is inside Suspense at the page level,
 * React preserves component state across Suspense transitions when the
 * component key doesn't change. The key risk was external state (like
 * useSearchParams returning null) causing conversationId to reset — but
 * now conversationId is local state that only updates from explicit
 * user actions or URL changes, not from Suspense transitions.
 */
function MessagesLayout() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(true);

  // Called by SearchParamsReader when URL params are available
  const handleParams = useCallback(
    (urlConvId: string | null, _tab: string | null) => {
      if (!initialized) {
        setConversationId(urlConvId);
        setInitialized(true);
        if (urlConvId) setIsMobileDrawerOpen(false);
      } else if (urlConvId !== null && urlConvId !== conversationId) {
        // External navigation (back/forward) — sync URL to state
        setConversationId(urlConvId);
      }
      // Ignore urlConvId === null after initialization — this happens
      // during Suspense transitions and would clear the active conversation
    },
    [initialized, conversationId]
  );

  useEffect(() => {
    if (conversationId) setIsMobileDrawerOpen(false);
  }, [conversationId]);

  const handleConversationSelect = useCallback((convId: string) => {
    setConversationId(convId);
    setIsMobileDrawerOpen(false);
    // Update URL for deep linking via history API
    const params = new URLSearchParams(window.location.search);
    params.set('conversation', convId);
    params.set('tab', 'chats');
    window.history.pushState({}, '', `/messages?${params.toString()}`);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsMobileDrawerOpen((prev) => !prev);
  }, []);

  return (
    <>
      <SetupCompleteToast />
      {/* Inner Suspense catches SearchParamsReader's suspension locally.
          The page-level Suspense satisfies Next.js but won't trigger because
          this inner boundary catches it first. This prevents the page-level
          Suspense from unmounting the entire MessagesLayout tree. */}
      <Suspense fallback={null}>
        <SearchParamsReader onParams={handleParams} />
      </Suspense>

      <div className="bg-base-100 fixed inset-x-0 top-16 bottom-28 overflow-hidden">
        <div className="drawer md:drawer-open h-full">
          <input
            id="sidebar-drawer"
            type="checkbox"
            className="drawer-toggle"
            checked={isMobileDrawerOpen}
            onChange={toggleDrawer}
          />

          <div className="drawer-content flex h-full flex-col overflow-hidden md:ml-80 lg:ml-96">
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
                <EmptyConversationPrompt onOpenSidebar={toggleDrawer} />
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
              onConversationSelect={handleConversationSelect}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default function MessagesPage() {
  return (
    <MessagingGate>
      <EncryptionKeyGate>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              <span className="loading loading-spinner loading-lg" />
            </div>
          }
        >
          <MessagesLayout />
        </Suspense>
      </EncryptionKeyGate>
    </MessagingGate>
  );
}

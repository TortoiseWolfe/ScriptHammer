'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessagingGate } from '@/components/auth/MessagingGate';
import { EncryptionKeyGate } from '@/components/auth/EncryptionKeyGate';
import ConversationView from '@/components/organisms/ConversationView';
import MessagesSidebar from '@/components/organisms/MessagesSidebar';
import EmptyConversationPrompt from '@/components/molecular/EmptyConversationPrompt';
import SetupCompleteToast from '@/components/molecular/SetupCompleteToast';

/**
 * Messages page — thin layout shell around extracted organisms.
 *
 * Owns: URL → conversationId, mobile drawer open/close, hamburger navbar.
 * Everything else (tab state, key checks, message state, setup toast)
 * lives in the extracted components.
 *
 * Mobile: drawer slides over chat. Tablet+: side-by-side via md:drawer-open.
 *
 * - /messages                     → Chats tab, empty prompt
 * - /messages?tab=connections     → Connections tab (MessagesSidebar reads)
 * - /messages?conversation=<id>   → ConversationView mounted
 */
function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = searchParams?.get('conversation') ?? null;

  // Drawer defaults open on mobile when there's no conversation yet
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(!conversationId);

  // Auto-close drawer when a conversation becomes active (deep link / back)
  useEffect(() => {
    if (conversationId) setIsMobileDrawerOpen(false);
  }, [conversationId]);

  const handleConversationSelect = useCallback(
    (convId: string) => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('conversation', convId);
      params.set('tab', 'chats');
      router.push(`/messages?${params.toString()}`);
      setIsMobileDrawerOpen(false);
    },
    [router, searchParams]
  );

  const toggleDrawer = useCallback(() => {
    setIsMobileDrawerOpen((prev) => !prev);
  }, []);

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
            onChange={toggleDrawer}
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
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        }
      >
        <EncryptionKeyGate>
          <MessagesContent />
        </EncryptionKeyGate>
      </Suspense>
    </MessagingGate>
  );
}

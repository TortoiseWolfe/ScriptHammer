'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatWindow from '@/components/organisms/ChatWindow';
import ConversationList from '@/components/organisms/ConversationList';
import { messageService } from '@/services/messaging/message-service';
import type { DecryptedMessage } from '@/types/messaging';

/**
 * Messages Content Component - wrapped in Suspense boundary
 */
function MessagesContent() {
  const searchParams = useSearchParams();
  const conversationId = searchParams?.get('conversation');

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState('User');

  useEffect(() => {
    if (conversationId) {
      loadConversationInfo();
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const loadConversationInfo = async () => {
    if (!conversationId) return;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Get conversation participants
      const { data: conversation } = await (supabase as any)
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) return;

      // Determine the other participant
      const otherParticipantId =
        conversation.participant_1_id === user.id
          ? conversation.participant_2_id
          : conversation.participant_1_id;

      // Get the other participant's profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('id', otherParticipantId)
        .single();

      if (profile) {
        setParticipantName(profile.display_name || profile.username || 'User');
      }
    } catch (err) {
      // Silently fail - participant name will default to "User"
    }
  };

  const loadMessages = async (loadMore = false) => {
    if (!conversationId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await messageService.getMessageHistory(
        conversationId,
        loadMore ? cursor : null,
        50
      );

      if (loadMore) {
        setMessages((prev) => [...result.messages, ...prev]);
      } else {
        setMessages(result.messages);

        if (result.messages.length > 0) {
          const firstOtherMessage = result.messages.find((m) => !m.isOwn);
          if (firstOtherMessage) {
            setParticipantName(firstOtherMessage.senderName);
          }
        }
      }

      // Mark unread messages from other participants as read
      const unreadMessages = result.messages.filter(
        (m) => !m.isOwn && !m.read_at
      );
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map((m) => m.id);
        messageService.markAsRead(messageIds).catch(() => {
          // Silently fail - read status is not critical
        });
      }

      setHasMore(result.has_more);
      setCursor(result.cursor);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!conversationId) return;

    try {
      setSending(true);
      setError(null);

      await messageService.sendMessage({
        conversation_id: conversationId,
        content,
      });

      await loadMessages();
    } catch (err: any) {
      // Display error message from service (already user-friendly)
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMessages(true);
    }
  };

  return (
    <div className="bg-base-100 fixed inset-0 flex flex-col md:flex-row">
      {/* Conversation List - Hidden on mobile when conversation selected */}
      <aside
        className={`border-base-300 w-full border-r md:w-80 lg:w-96 ${
          conversationId ? 'hidden md:block' : ''
        }`}
      >
        <ConversationList selectedConversationId={conversationId} />
      </aside>

      {/* Chat Window - Hidden on mobile when no conversation selected */}
      <main
        className={`flex-1 ${
          !conversationId ? 'hidden md:flex' : 'flex'
        } flex-col`}
      >
        {conversationId ? (
          <>
            {error && (
              <div className="alert alert-info m-4" role="alert">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="h-6 w-6 shrink-0 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="btn btn-ghost btn-sm"
                >
                  Dismiss
                </button>
              </div>
            )}
            <ChatWindow
              conversationId={conversationId}
              messages={messages}
              onSendMessage={handleSendMessage}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              loading={loading}
              sending={sending}
              participantName={participantName}
            />
          </>
        ) : (
          <div className="bg-base-200 flex h-full items-center justify-center">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="text-base-content/30 mx-auto mb-4 h-24 w-24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
              <h2 className="mb-2 text-xl font-semibold">
                Select a conversation
              </h2>
              <p className="text-base-content/70">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Messages Page with Responsive Split Layout
 *
 * Mobile: ConversationList OR ChatWindow (full screen)
 * Tablet+: ConversationList AND ChatWindow (side-by-side)
 *
 * Usage: /messages?conversation=<conversation_id>
 */
export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}

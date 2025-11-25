'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string | null;
  created_at: string;
  participant_name: string;
  participant_username: string;
}

/**
 * Helper: Wrap a promise with a timeout
 * @param promise The promise to wrap
 * @param ms Timeout in milliseconds
 * @returns Promise that rejects if timeout exceeded
 */
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout')), ms)
  );
  return Promise.race([promise, timeout]);
};

/**
 * Conversations List Page
 * Simple UI to view and select conversations
 */
export default function ConversationsPage() {
  const {
    user,
    isLoading: authLoading,
    error: authError,
    retry,
    clearError,
  } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Diagnostic logging (FR-001, FR-007)
  console.log('[Conversations] Render', {
    authLoading,
    user: !!user,
    loading,
    error,
  });

  const loadConversations = useCallback(async () => {
    console.log('[Conversations] loadConversations START');
    if (!user) {
      console.log('[Conversations] No user, returning');
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();

      console.log('[Conversations] Querying conversations...');
      // Get all conversations for this user with 10-second timeout (FR-003)
      const result = await withTimeout(
        (supabase as any)
          .from('conversations')
          .select('*')
          .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false, nullsFirst: false }),
        10000
      );
      const { data: convos, error: convError } = result as {
        data: Conversation[] | null;
        error: { message: string } | null;
      };

      console.log('[Conversations] Query result', {
        count: convos?.length,
        error: convError,
      });

      if (convError) {
        setError('Failed to load conversations: ' + convError.message);
        setLoading(false);
        return;
      }

      if (!convos || convos.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get participant IDs
      const participantIds = convos.flatMap((c: Conversation) =>
        c.participant_1_id === user.id
          ? [c.participant_2_id]
          : [c.participant_1_id]
      );

      // Fetch participant profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name')
        .in('id', participantIds);

      // Map profiles to conversations
      const conversationsWithNames = convos.map((c: Conversation) => {
        const otherParticipantId =
          c.participant_1_id === user.id
            ? c.participant_2_id
            : c.participant_1_id;

        const profile = profiles?.find((p: any) => p.id === otherParticipantId);

        return {
          ...c,
          participant_name:
            profile?.display_name || profile?.username || 'Unknown',
          participant_username: profile?.username || 'unknown',
        };
      });

      setConversations(conversationsWithNames);
    } catch (err: any) {
      console.log('[Conversations] Error caught', err);
      // User-friendly error messages (FR-004)
      if (err.message === 'Query timeout') {
        setError('Loading took too long. Please try again.');
      } else {
        setError(err.message || 'Failed to load conversations');
      }
    } finally {
      console.log(
        '[Conversations] loadConversations END - setting loading=false'
      );
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('[Conversations] useEffect triggered', {
      authLoading,
      user: !!user,
    });
    if (!authLoading && user) {
      loadConversations();
    } else if (!authLoading && !user) {
      console.log('[Conversations] No user after auth, showing sign-in prompt');
      setLoading(false);
      setError('Please sign in to view conversations');
    }
  }, [user, authLoading, loadConversations]);

  const handleSelectConversation = (conversationId: string) => {
    router.push(`/messages?conversation=${conversationId}`);
  };

  // Auth error state - show error with retry option (FR-006)
  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="alert alert-error max-w-md flex-col gap-4">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{authError.message}</span>
          </div>
          {authError.retryable && (
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" onClick={retry}>
                Retry
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  clearError();
                  router.push('/sign-in');
                }}
              >
                Sign in again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="alert alert-error max-w-md flex-col gap-4">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                setError(null);
                loadConversations();
              }}
            >
              Retry
            </button>
            {error === 'Please sign in to view conversations' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => router.push('/sign-in')}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Conversations</h1>
        <p className="text-base-content/70 mt-2">
          Select a conversation to start messaging
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title">No Conversations Yet</h2>
            <p>
              You don&apos;t have any conversations. Start by connecting with
              someone!
            </p>
            <div className="card-actions mt-4 justify-end">
              <a href="/messages/connections" className="btn btn-primary">
                Find People to Connect
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all"
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="card-title text-lg">
                      {conversation.participant_name}
                    </h3>
                    <p className="text-base-content/60 text-sm">
                      @{conversation.participant_username}
                    </p>
                  </div>
                  <div className="text-base-content/60 text-right text-sm">
                    {conversation.last_message_at
                      ? new Date(
                          conversation.last_message_at
                        ).toLocaleDateString()
                      : 'No messages'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

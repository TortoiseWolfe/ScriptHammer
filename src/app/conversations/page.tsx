'use client';

import React, { useState, useEffect } from 'react';
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
 * Conversations List Page
 * Simple UI to view and select conversations
 */
export default function ConversationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        loadConversations();
      } else {
        setLoading(false);
        setError('Please sign in to view conversations');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const supabase = createClient();

      // Get all conversations for this user
      const { data: convos, error: convError } = await (supabase as any)
        .from('conversations')
        .select('*')
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convError) {
        setError('Failed to load conversations: ' + convError.message);
        return;
      }

      if (!convos || convos.length === 0) {
        setConversations([]);
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
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    router.push(`/messages?conversation=${conversationId}`);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="alert alert-error max-w-md">
          <span>{error}</span>
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

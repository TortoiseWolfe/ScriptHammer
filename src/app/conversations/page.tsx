import { redirect } from 'next/navigation';

/**
 * Conversations Page - Redirect to unified messaging
 *
 * This page has been consolidated into /messages with the Chats tab.
 * @see Feature 037 - Unified Messaging Sidebar
 */
export default function ConversationsPage() {
  redirect('/messages?tab=chats');
}

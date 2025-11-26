import { redirect } from 'next/navigation';

/**
 * Connections Page - Redirect to unified messaging
 *
 * This page has been consolidated into /messages with the Connections tab.
 * @see Feature 037 - Unified Messaging Sidebar
 */
export default function ConnectionsRedirectPage() {
  redirect('/messages?tab=connections');
}

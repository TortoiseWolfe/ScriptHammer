/**
 * AuthContext construction (#266).
 *
 * Every {@link MessagingDataProvider} method takes an explicit
 * {@link AuthContext} instead of relying on an ambient identity, because a
 * .NET/EF Core backend has no in-database `auth.uid()` to fall back on. This is
 * the one place that turns a Supabase session into that context, shared by every
 * domain service that talks to the seam (`message-service.ts`,
 * `connection-service.ts`).
 *
 * @module services/messaging/providers/auth-context
 */

import type { Session } from '@supabase/supabase-js';
import type { AuthContext } from './types';

/**
 * Build the explicit {@link AuthContext} a provider needs from a Supabase
 * session. On Supabase the ambient session still drives RLS, but the provider
 * interface is backend-agnostic, so identity is passed explicitly — and the .NET
 * provider sends `accessToken` as its bearer token.
 */
export function authContextFromSession(session: Session): AuthContext {
  return {
    userId: session.user.id,
    accessToken: session.access_token,
  };
}

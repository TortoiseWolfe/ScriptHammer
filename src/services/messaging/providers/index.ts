/**
 * Messaging Provider Registry (#266)
 *
 * Selects the active {@link MessagingDataProvider} implementation from
 * `backendConfig.provider` (`NEXT_PUBLIC_BACKEND_PROVIDER`), mirroring the
 * env-var-provider precedent in `calendar.config.ts` and the injectable-registry
 * shape of `EmailService` (`resolveMessagingProvider(override)` is the DI seam
 * tests use to swap in a fake or the other real provider).
 *
 * @module services/messaging/providers
 */

import { backendConfig } from '@/config/backend.config';
import { DotnetMessagingProvider } from './dotnet-provider';
import { SupabaseMessagingProvider } from './supabase-provider';
import type { MessagingDataProvider } from './types';

export { authContextFromSession } from './auth-context';

export type {
  AuthContext,
  BackendProviderName,
  ChangeEvent,
  ConversationMeta,
  EditMessagePayload,
  GetMessagesParams,
  MessagesPage,
  MessagingDataProvider,
  MessagingRealtimeProvider,
  MessagingTable,
  SendMessagePayload,
  SubscribeOptions,
  Subscription,
} from './types';

/**
 * Resolve the active messaging provider.
 *
 * @param override - Inject a provider directly (test DI seam). When supplied it
 *   wins over the env-configured selection.
 */
export function resolveMessagingProvider(
  override?: MessagingDataProvider
): MessagingDataProvider {
  if (override) return override;
  if (backendConfig.provider === 'dotnet') {
    return new DotnetMessagingProvider(backendConfig.dotnetBaseUrl);
  }
  return new SupabaseMessagingProvider();
}

/**
 * The env-selected messaging provider singleton. `MessageService` defaults to
 * this; tests pass their own via the constructor.
 */
export const messagingProvider: MessagingDataProvider =
  resolveMessagingProvider();

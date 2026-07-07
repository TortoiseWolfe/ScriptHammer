import type { User } from '@supabase/supabase-js';
import type { DerivedKeyPair } from '@/types/messaging';
import type { Logger } from '@/lib/logger/logger';

/**
 * Dispatch the encrypted welcome message after a user initializes their
 * messaging keys. Extracted from `src/app/messages/setup/page.tsx` so the
 * full-page setup flow AND the modal-setup flow (Feature 013) can share
 * one dispatch implementation instead of duplicating it.
 *
 * Fire-and-forget: errors are logged but never surfaced to the caller, so
 * a failed welcome message never blocks the user from reaching `/messages`.
 * This matches the prior behavior verbatim — only the call site changed.
 */
export function sendWelcomeMessageOnSetup(
  user: User | null,
  keyPair: DerivedKeyPair,
  logger: Logger
): void {
  if (!user?.id || !keyPair.privateKey || !keyPair.publicKeyJwk) {
    return;
  }

  import('@/services/messaging/welcome-service')
    .then(({ welcomeService }) => {
      welcomeService
        .sendWelcomeMessage(user.id, keyPair.privateKey, keyPair.publicKeyJwk)
        .catch((err: Error) => {
          logger.error('Welcome message failed', { error: err });
        });
    })
    .catch((err: Error) => {
      logger.error('Failed to load welcome service', { error: err });
    });
}

/**
 * Connection Status Listener
 * Monitors Supabase connection and auto-syncs offline queue when online
 */

import { isSupabaseOnline } from '@/lib/supabase/client';
import { processPendingOperations, getPendingCount } from './offline-queue';
import { createLogger } from '@/lib/logger';

const logger = createLogger('payments:connection');

let listenerInterval: NodeJS.Timeout | null = null;
let isListening = false;

/**
 * Start monitoring connection status
 * Auto-syncs queue when connection returns
 */
export function startConnectionListener(): () => void {
  if (isListening) {
    logger.warn('Connection listener already running');
    return stopConnectionListener;
  }

  isListening = true;
  logger.info('Starting connection listener');

  const checkConnection = async () => {
    const isOnline = await isSupabaseOnline();

    if (isOnline) {
      const pendingCount = await getPendingCount();

      if (pendingCount > 0) {
        logger.info('Connection restored! Processing queued operations', {
          pendingCount,
        });
        try {
          await processPendingOperations();
          logger.info('Queue processed successfully');
        } catch (error) {
          logger.error('Failed to process queue', { error });
        }
      }
    }
  };

  // Check every 30 seconds
  listenerInterval = setInterval(checkConnection, 30000);

  // Check when page becomes visible
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      logger.debug('Page visible - checking connection');
      checkConnection();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Check when browser reports online
  const handleOnline = () => {
    logger.debug('Browser online event - checking connection');
    checkConnection();
  };
  window.addEventListener('online', handleOnline);

  // Initial check
  checkConnection();

  // Return cleanup function
  return () => {
    if (listenerInterval) {
      clearInterval(listenerInterval);
      listenerInterval = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleOnline);
    isListening = false;
    logger.info('Connection listener stopped');
  };
}

/**
 * Stop monitoring connection status
 */
export function stopConnectionListener(): void {
  if (listenerInterval) {
    clearInterval(listenerInterval);
    listenerInterval = null;
  }
  isListening = false;
}

/**
 * Check if listener is currently running
 */
export function isConnectionListenerActive(): boolean {
  return isListening;
}

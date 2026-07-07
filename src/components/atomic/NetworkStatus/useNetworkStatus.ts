import { useState, useEffect } from 'react';

export interface NetworkStatusHookReturn {
  isOnline: boolean;
  wasOffline: boolean;
}

/**
 * useNetworkStatus Hook
 * Task: T119
 *
 * Monitors browser online/offline status using navigator.onLine API.
 * Tracks whether user was recently offline to show reconnection feedback.
 */
export function useNetworkStatus(): NetworkStatusHookReturn {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Clear "was offline" flag after 3 seconds
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}

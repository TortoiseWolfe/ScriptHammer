import { useState, useEffect, useCallback, useRef } from 'react';

interface UseIdleTimeoutOptions {
  timeoutMinutes: number;
  warningMinutes?: number;
  onWarning?: () => void;
  onTimeout?: () => void;
}

export function useIdleTimeout({
  timeoutMinutes,
  warningMinutes = 1,
  onWarning,
  onTimeout,
}: UseIdleTimeoutOptions) {
  const [isIdle, setIsIdle] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeoutMinutes * 60);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsIdle(false);
    warningShownRef.current = false;
    setTimeRemaining(timeoutMinutes * 60);
  }, [timeoutMinutes]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = timeoutMinutes * 60 - elapsed;
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        setIsIdle(true);
        onTimeout?.();
      } else if (remaining <= warningMinutes * 60 && !warningShownRef.current) {
        warningShownRef.current = true;
        onWarning?.();
      }
    }, 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(interval);
    };
  }, [timeoutMinutes, warningMinutes, resetTimer, onWarning, onTimeout]);

  return { isIdle, timeRemaining, resetTimer };
}

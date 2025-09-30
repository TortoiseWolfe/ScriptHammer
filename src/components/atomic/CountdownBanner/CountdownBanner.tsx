'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/atomic/Button';

const DISMISS_KEY = 'countdown-dismissed';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const CountdownBanner = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  // Check dismissal on mount
  useEffect(() => {
    setMounted(true);
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const timeSinceDismissal = Date.now() - parseInt(dismissedAt, 10);
        setIsDismissed(timeSinceDismissal < DISMISS_DURATION);
      }
    } catch (e) {
      // Safari private mode - user will see banner every time
      setIsDismissed(false);
    }
  }, []);

  // Calculate and update countdown
  useEffect(() => {
    if (!mounted || isDismissed) return;

    const calculateTimeLeft = () => {
      const targetDate = new Date(new Date().getFullYear() + 1, 0, 1);
      const difference = targetDate.getTime() - new Date().getTime();

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false,
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [mounted, isDismissed]);

  if (!mounted || isDismissed || timeLeft.isExpired) return null;

  return (
    <div
      className="bg-warning text-warning-content fixed top-40 right-4 z-50 max-w-xs rounded-lg p-3 shadow-xl max-sm:top-56 max-sm:right-4 max-sm:left-4 max-sm:max-w-full"
      role="banner"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏰</span>
          <div>
            <span className="font-bold">New Year Special</span>
            <div className="font-mono text-lg">
              {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m{' '}
              {timeLeft.seconds}s
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold">$321/year</div>
            <div className="text-sm">Custom ScriptHammer Setup</div>
          </div>
          <Button variant="accent" onClick={() => router.push('/schedule')}>
            Book Now
          </Button>
        </div>

        <button
          className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, Date.now().toString());
              setIsDismissed(true);
            } catch (e) {
              setIsDismissed(true);
            }
          }}
          aria-label="Dismiss countdown banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

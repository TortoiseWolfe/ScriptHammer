'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/atomic/Button';

const DISMISS_KEY = 'countdown-dismissed';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const SEASON_PRICES: Record<number, string> = {
  2024: '$321/yr',
  2025: '$432.10/yr',
  2026: '$543.21/yr',
  2027: '$654.32/yr',
  2028: '$765.43/yr',
  2029: '$876.54/yr',
  2030: '$987.65/yr',
};

function getSeasonPrice(year: number): string {
  if (year <= 2024) return SEASON_PRICES[2024];
  if (year >= 2030) return SEASON_PRICES[2030];
  return SEASON_PRICES[year];
}

function isInSeason(now: Date): boolean {
  const year = now.getFullYear();
  const seasonStart = new Date(year, 9, 31); // Oct 31
  const seasonEnd = new Date(year, 11, 31, 23, 59, 59, 999); // Dec 31 EOD
  return now >= seasonStart && now <= seasonEnd;
}

export const CountdownBanner = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [inSeason, setInSeason] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Check dismissal and season on mount
  useEffect(() => {
    setMounted(true);
    setInSeason(isInSeason(new Date()));
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

  // Calculate and update countdown to Jan 1
  useEffect(() => {
    if (!mounted || isDismissed || !inSeason) return;

    const calculateTimeLeft = () => {
      const targetDate = new Date(new Date().getFullYear() + 1, 0, 1);
      const difference = targetDate.getTime() - new Date().getTime();

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [mounted, isDismissed, inSeason]);

  if (!mounted || isDismissed || !inSeason) return null;

  const price = getSeasonPrice(new Date().getFullYear());

  return (
    <aside
      className="bg-warning text-warning-content fixed top-40 right-4 z-50 max-w-xs rounded-lg p-3 shadow-xl max-sm:top-56 max-sm:right-4 max-sm:left-4 max-sm:max-w-full"
      aria-label="Promotional countdown"
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
            <div className="text-2xl font-bold">{price}</div>
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
    </aside>
  );
};

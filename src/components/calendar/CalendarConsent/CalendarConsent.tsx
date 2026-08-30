'use client';

import { useConsent } from '@/contexts/ConsentContext';
import { CookieCategory } from '@/utils/consent-types';

interface CalendarConsentProps {
  provider: string;
  /**
   * The booking URL, so someone who does not want third-party cookies can still book
   * (#919). Optional because a misconfigured deployment has none, and a dead link is
   * worse than no link.
   */
  url?: string;
  /**
   * Optional. Accepting updates consent, and the context re-render is what swaps this
   * card for the calendar — so callers that need nothing extra pass nothing, rather than
   * an empty function that reads like an unfinished stub.
   */
  onAccept?: () => void;
}

export default function CalendarConsent({
  provider,
  url,
  onAccept,
}: CalendarConsentProps) {
  const { updateConsent } = useConsent();
  const name = provider === 'calcom' ? 'Cal.com' : 'Calendly';

  const handleAccept = () => {
    updateConsent(CookieCategory.FUNCTIONAL, true);
    onAccept?.();
  };

  return (
    <div className="card bg-base-200">
      <div className="card-body">
        {/*
          THE HEADING IS THE GOAL, NOT THE MECHANISM (#919).

          This said "Calendar Consent Required", which is the machinery talking. /schedule
          is the front door for every booking link in the product — the nav, three places
          on the home page, the countdown banner and the pricing page's "Book a call" — so
          a first-time visitor's first impression of it was a cookie card.
        */}
        <h3 className="card-title">Pick a time to talk</h3>
        <p>
          The calendar is hosted by {name}, and loading it sets their cookies.
          We ask first.
        </p>
        <div className="card-actions mt-2 flex-wrap justify-end gap-2">
          {/*
            A WAY THROUGH WITHOUT CONSENTING. Accept used to be the only control, so a
            visitor who declines third-party cookies was dead-ended on the one page whose
            job is booking. BookingStep already offers a plain link instead of an embed;
            this is the same idea, for the person who never gets to the embed.
          */}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost min-h-11 min-w-11"
            >
              Book on {name} instead
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <button
            className="btn btn-primary min-h-11 min-w-11"
            onClick={handleAccept}
          >
            Load the calendar
          </button>
        </div>
      </div>
    </div>
  );
}

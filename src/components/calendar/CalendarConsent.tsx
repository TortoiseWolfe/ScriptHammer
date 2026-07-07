'use client';

import { useConsent } from '@/contexts/ConsentContext';
import { CookieCategory } from '@/utils/consent-types';

interface CalendarConsentProps {
  provider: string;
  onAccept: () => void;
}

export default function CalendarConsent({
  provider,
  onAccept,
}: CalendarConsentProps) {
  const { updateConsent } = useConsent();

  const handleAccept = () => {
    updateConsent(CookieCategory.FUNCTIONAL, true);
    onAccept();
  };

  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <h3 className="card-title">Calendar Consent Required</h3>
        <p>
          To display the {provider === 'calcom' ? 'Cal.com' : 'Calendly'}{' '}
          calendar, we need your consent to load third-party content. This will
          enable scheduling functionality.
        </p>
        <div className="card-actions justify-end">
          <button className="btn btn-primary" onClick={handleAccept}>
            Accept and Show Calendar
          </button>
        </div>
      </div>
    </div>
  );
}

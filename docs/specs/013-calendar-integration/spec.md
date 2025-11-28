# Product Requirements Prompt (PRP)

**Feature Name**: Calendar Integration (Calendly/Cal.com)  
**Priority**: P2 (Constitutional Enhancement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A calendar scheduling integration that embeds Calendly or Cal.com into the application, allowing users to book appointments directly. The implementation will support both providers with a clean abstraction layer and responsive embed design.

### Why We're Building It

- Constitutional requirement (Section 6, Phase 2: Calendar Integration)
- Essential for service-based businesses
- Reduces back-and-forth scheduling emails
- Professional appointment booking experience
- Both providers offer generous free tiers

### Success Criteria

- [ ] Calendar embed renders responsively
- [ ] Both Calendly and Cal.com supported
- [ ] Custom styling matches app theme
- [ ] Event types configurable
- [ ] UTM tracking for analytics
- [ ] Fallback for unsupported browsers
- [ ] GDPR compliant (consent required)
- [ ] Accessibility standards met
- [ ] Works across all 32 themes

### Out of Scope

- Custom calendar backend
- Direct calendar API integration
- Multi-calendar sync
- Payment processing (use provider's features)
- Custom availability rules

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Dynamic Component Loading

```typescript
// Pattern from Map component
import dynamic from 'next/dynamic';

const Calendar = dynamic(() => import('@/components/Calendar'), {
  ssr: false,
  loading: () => <div>Loading calendar...</div>
});
```

#### Theme Integration

```typescript
// Get current theme for styling
const theme = document.documentElement.getAttribute('data-theme');
const isDark = ['dark', 'dracula', 'night'].includes(theme);
```

#### Consent Check

```typescript
// From Cookie Consent PRP
import { useConsent } from '@/contexts/ConsentContext';
const { consent } = useConsent();

if (!consent.functional) {
  return <ConsentRequired />;
}
```

### Dependencies & Libraries

```bash
# Calendly React component
pnpm add react-calendly

# Cal.com embed
pnpm add @calcom/embed-react

# No additional dependencies needed
```

### File Structure

```
src/
├── components/
│   └── calendar/
│       ├── CalendarEmbed/
│       │   ├── index.tsx
│       │   ├── CalendarEmbed.tsx
│       │   ├── CalendarEmbed.test.tsx
│       │   └── CalendarEmbed.stories.tsx
│       ├── providers/
│       │   ├── CalendlyProvider.tsx
│       │   └── CalComProvider.tsx
│       └── CalendarConsent.tsx
├── config/
│   └── calendar.config.ts
└── app/
    └── schedule/
        └── page.tsx
```

---

## 3. Technical Specifications

### Calendar Configuration

```typescript
// src/config/calendar.config.ts
export interface CalendarConfig {
  provider: 'calendly' | 'calcom';
  url: string;
  eventTypes?: string[];
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
  styles?: {
    height?: string;
    minHeight?: string;
    backgroundColor?: string;
  };
}

export const calendarConfig: CalendarConfig = {
  provider:
    (process.env.NEXT_PUBLIC_CALENDAR_PROVIDER as 'calendly' | 'calcom') ||
    'calendly',
  url: process.env.NEXT_PUBLIC_CALENDAR_URL || '',
  utm: {
    source: 'scripthammer',
    medium: 'embed',
    campaign: 'website',
  },
  styles: {
    height: '700px',
    minHeight: '500px',
  },
};
```

### Calendly Provider

```typescript
// src/components/calendar/providers/CalendlyProvider.tsx
import { InlineWidget, PopupWidget, useCalendlyEventListener } from 'react-calendly';
import { useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

interface CalendlyProviderProps {
  url: string;
  mode: 'inline' | 'popup';
  utm?: Record<string, string>;
  styles?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    customAnswers?: Record<string, string>;
  };
}

export function CalendlyProvider({
  url,
  mode = 'inline',
  utm,
  styles,
  prefill
}: CalendlyProviderProps) {
  const analytics = useAnalytics();

  // Track calendar events
  useCalendlyEventListener({
    onProfilePageViewed: () => analytics.track('calendar_viewed', 'Calendar', 'Calendly'),
    onDateAndTimeSelected: () => analytics.track('calendar_time_selected', 'Calendar', 'Calendly'),
    onEventScheduled: (e) => {
      analytics.track('calendar_scheduled', 'Calendar', 'Calendly', e.data.payload.invitee.name);
    }
  });

  // Apply theme-aware styles
  const theme = document.documentElement.getAttribute('data-theme');
  const isDark = ['dark', 'dracula', 'night', 'coffee', 'dim', 'sunset'].includes(theme || '');

  const pageSettings = {
    backgroundColor: isDark ? '1a1a1a' : 'ffffff',
    hideEventTypeDetails: false,
    hideLandingPageDetails: false,
    primaryColor: '00a2ff',
    textColor: isDark ? 'ffffff' : '000000'
  };

  if (mode === 'popup') {
    return (
      <PopupWidget
        url={url}
        utm={utm}
        prefill={prefill}
        pageSettings={pageSettings}
        text="Schedule a Meeting"
        className="btn btn-primary"
      />
    );
  }

  return (
    <InlineWidget
      url={url}
      utm={utm}
      prefill={prefill}
      pageSettings={pageSettings}
      styles={{
        height: styles?.height || '700px',
        minHeight: styles?.minHeight || '500px',
        ...styles
      }}
    />
  );
}
```

### Cal.com Provider

```typescript
// src/components/calendar/providers/CalComProvider.tsx
import Cal, { getCalApi } from '@calcom/embed-react';
import { useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

interface CalComProviderProps {
  calLink: string;
  mode: 'inline' | 'popup';
  config?: {
    name?: string;
    email?: string;
    notes?: string;
    guests?: string[];
    theme?: 'light' | 'dark' | 'auto';
  };
  styles?: Record<string, string>;
}

export function CalComProvider({
  calLink,
  mode = 'inline',
  config,
  styles
}: CalComProviderProps) {
  const analytics = useAnalytics();

  useEffect(() => {
    (async function () {
      const cal = await getCalApi();

      // Listen for Cal.com events
      cal('on', {
        action: 'bookingSuccessful',
        callback: (e) => {
          analytics.track('calendar_scheduled', 'Calendar', 'Cal.com', e.detail.name);
        }
      });

      cal('on', {
        action: 'linkReady',
        callback: () => {
          analytics.track('calendar_viewed', 'Calendar', 'Cal.com');
        }
      });
    })();
  }, []);

  // Auto-detect theme
  const theme = document.documentElement.getAttribute('data-theme');
  const isDark = ['dark', 'dracula', 'night', 'coffee', 'dim', 'sunset'].includes(theme || '');

  if (mode === 'popup') {
    return (
      <button
        className="btn btn-primary"
        data-cal-link={calLink}
        data-cal-config={JSON.stringify({
          ...config,
          theme: isDark ? 'dark' : 'light'
        })}
      >
        Schedule a Meeting
      </button>
    );
  }

  return (
    <Cal
      calLink={calLink}
      style={{
        width: '100%',
        height: styles?.height || '700px',
        minHeight: styles?.minHeight || '500px',
        overflow: 'hidden',
        ...styles
      }}
      config={{
        ...config,
        theme: isDark ? 'dark' : 'light',
        branding: {
          brandColor: '#00a2ff'
        }
      }}
    />
  );
}
```

### Main Calendar Component

```typescript
// src/components/calendar/CalendarEmbed/CalendarEmbed.tsx
'use client';

import { useConsent } from '@/contexts/ConsentContext';
import { CalendlyProvider } from '../providers/CalendlyProvider';
import { CalComProvider } from '../providers/CalComProvider';
import { calendarConfig } from '@/config/calendar.config';
import CalendarConsent from '../CalendarConsent';

interface CalendarEmbedProps {
  mode?: 'inline' | 'popup';
  url?: string;
  provider?: 'calendly' | 'calcom';
  prefill?: {
    name?: string;
    email?: string;
  };
  className?: string;
}

export default function CalendarEmbed({
  mode = 'inline',
  url = calendarConfig.url,
  provider = calendarConfig.provider,
  prefill,
  className
}: CalendarEmbedProps) {
  const { consent } = useConsent();

  // Require functional consent for calendar embedding
  if (!consent.functional) {
    return (
      <CalendarConsent
        provider={provider}
        onAccept={() => {
          // Update consent will trigger re-render
        }}
      />
    );
  }

  if (!url) {
    return (
      <div className="alert alert-warning">
        <span>Calendar URL not configured. Please add NEXT_PUBLIC_CALENDAR_URL to environment.</span>
      </div>
    );
  }

  const containerClasses = `
    ${mode === 'inline' ? 'w-full rounded-lg overflow-hidden shadow-xl' : ''}
    ${className || ''}
  `;

  return (
    <div className={containerClasses}>
      {provider === 'calendly' ? (
        <CalendlyProvider
          url={url}
          mode={mode}
          utm={calendarConfig.utm}
          styles={calendarConfig.styles}
          prefill={prefill}
        />
      ) : (
        <CalComProvider
          calLink={url}
          mode={mode}
          config={prefill}
          styles={calendarConfig.styles}
        />
      )}
    </div>
  );
}
```

### Consent Component

```typescript
// src/components/calendar/CalendarConsent.tsx
interface CalendarConsentProps {
  provider: string;
  onAccept: () => void;
}

export default function CalendarConsent({ provider, onAccept }: CalendarConsentProps) {
  const { updateConsent } = useConsent();

  const handleAccept = () => {
    updateConsent('functional', true);
    onAccept();
  };

  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <h3 className="card-title">Calendar Consent Required</h3>
        <p>
          To display the {provider} calendar, we need your consent to load third-party content.
          This will enable scheduling functionality.
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
```

### Schedule Page

```typescript
// app/schedule/page.tsx
import dynamic from 'next/dynamic';

const CalendarEmbed = dynamic(
  () => import('@/components/calendar/CalendarEmbed'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }
);

export default function SchedulePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Schedule a Meeting</h1>

        <div className="prose mb-8">
          <p>
            Book a time that works for you. We'll send a calendar invitation
            with all the details.
          </p>
        </div>

        <CalendarEmbed mode="inline" />

        <div className="mt-8 text-center text-sm opacity-60">
          <p>Powered by {process.env.NEXT_PUBLIC_CALENDAR_PROVIDER === 'calcom' ? 'Cal.com' : 'Calendly'}</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Implementation Runbook

### Step 1: Choose & Setup Provider

#### Calendly Setup

1. Create account at calendly.com
2. Set up event types
3. Get scheduling link
4. Add to .env.local:

```bash
NEXT_PUBLIC_CALENDAR_PROVIDER=calendly
NEXT_PUBLIC_CALENDAR_URL=https://calendly.com/your-username/event
```

#### Cal.com Setup

1. Create account at cal.com
2. Configure availability
3. Get booking link
4. Add to .env.local:

```bash
NEXT_PUBLIC_CALENDAR_PROVIDER=calcom
NEXT_PUBLIC_CALENDAR_URL=your-username/meeting
```

### Step 2: Install Dependencies

```bash
# For Calendly
pnpm add react-calendly

# For Cal.com
pnpm add @calcom/embed-react
```

### Step 3: Create Components

```bash
mkdir -p src/components/calendar/providers
mkdir -p src/components/calendar/CalendarEmbed
mkdir -p app/schedule

# Create component files
touch src/components/calendar/CalendarEmbed/{index.tsx,CalendarEmbed.tsx,CalendarEmbed.test.tsx,CalendarEmbed.stories.tsx}
touch src/components/calendar/providers/{CalendlyProvider.tsx,CalComProvider.tsx}
touch src/components/calendar/CalendarConsent.tsx
touch src/config/calendar.config.ts
touch app/schedule/page.tsx
```

### Step 4: Testing

- [ ] Calendar loads with consent
- [ ] Theme switching works
- [ ] Responsive on mobile
- [ ] Analytics events fire
- [ ] Both providers work
- [ ] Popup mode works

---

## 5. Validation Loops

### Pre-Implementation Checks

- [ ] Provider account created
- [ ] Event types configured
- [ ] Scheduling URL obtained
- [ ] Consent system understood

### During Implementation

- [ ] Embed renders correctly
- [ ] Theme detection works
- [ ] Analytics integrated
- [ ] Consent flow smooth

### Post-Implementation

- [ ] Bookings successful
- [ ] Notifications received
- [ ] Calendar invites sent
- [ ] Mobile experience good

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Third-party service downtime
   **Mitigation**: Show status message, provide email fallback

2. **Risk**: GDPR compliance issues
   **Mitigation**: Require consent, document data flow

3. **Risk**: Theme mismatch with embed
   **Mitigation**: Pass theme colors to embed configuration

4. **Risk**: Mobile responsiveness issues
   **Mitigation**: Test thoroughly, provide mobile-specific view

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 6, Phase 2)
- Consent Context: `/src/contexts/ConsentContext.tsx`
- Theme System: `/src/components/ThemeSwitcher.tsx`
- Analytics Hook: `/src/hooks/useAnalytics.ts`

### External Resources

- [Calendly Developers](https://developer.calendly.com/)
- [React Calendly](https://github.com/tcampb/react-calendly)
- [Cal.com Embed Docs](https://cal.com/docs/core-features/embed)
- [Cal.com React Component](https://www.npmjs.com/package/@calcom/embed-react)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox → Processed)

- [ ] Specification generated
- [ ] Plan created
- [ ] Tasks broken down
- [ ] Implementation started
- [ ] Completed on: [PENDING]

---

<!--
PRP for Calendar Integration
Generated from SpecKit constitution analysis
Supports both Calendly and Cal.com providers
-->

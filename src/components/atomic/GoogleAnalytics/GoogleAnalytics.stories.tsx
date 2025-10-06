import type { Meta, StoryObj } from '@storybook/nextjs';
import GoogleAnalytics from './GoogleAnalytics';
import React from 'react';

// Mock ConsentProvider for stories
const MockConsentWrapper = ({
  children,
  analyticsConsent = true,
}: {
  children: React.ReactNode;
  analyticsConsent?: boolean;
}) => {
  return (
    <div>
      <div className="bg-base-200 mb-4 rounded-lg p-4">
        <h3 className="mb-2 font-bold">Consent Status:</h3>
        <p>
          Analytics Consent: {analyticsConsent ? '✅ Granted' : '❌ Denied'}
        </p>
        <p className="mt-2 text-sm opacity-70">
          {analyticsConsent
            ? 'GA4 scripts would be loaded and tracking enabled'
            : 'No scripts loaded, no tracking occurs'}
        </p>
      </div>
      {children}
    </div>
  );
};

const meta: Meta<typeof GoogleAnalytics> = {
  title: 'Features/Analytics/GoogleAnalytics',
  component: GoogleAnalytics,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The GoogleAnalytics component integrates Google Analytics 4 (GA4) with consent awareness.
It only loads and tracks when analytics consent is granted through the ConsentContext.

## Key Features
- **Privacy-first**: Analytics disabled by default
- **Consent-aware**: Respects user cookie preferences
- **Automatic page view tracking**: Tracks route changes
- **Web Vitals integration**: Can track Core Web Vitals
- **CSP compliant**: Works with Content Security Policy

## Requirements
- Requires \`NEXT_PUBLIC_GA_MEASUREMENT_ID\` environment variable
- Must be wrapped in ConsentProvider
- Analytics consent must be granted for tracking

## Usage
\`\`\`tsx
// In app/layout.tsx
import GoogleAnalytics from '@/components/atomic/GoogleAnalytics';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ConsentProvider>
          <GoogleAnalytics />
          {children}
        </ConsentProvider>
      </body>
    </html>
  );
}
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => (
      <MockConsentWrapper
        analyticsConsent={
          (context.args as { analyticsConsent?: boolean }).analyticsConsent
        }
      >
        <Story />
      </MockConsentWrapper>
    ),
  ],
  argTypes: {
    analyticsConsent: {
      control: 'boolean',
      description: 'Whether analytics consent is granted',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsentGranted: Story = {
  args: {
    analyticsConsent: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When analytics consent is granted, GA4 scripts are loaded and tracking is enabled. The component itself renders nothing visible.',
      },
    },
  },
};

export const ConsentDenied: Story = {
  args: {
    analyticsConsent: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When analytics consent is denied (default state), no scripts are loaded and no tracking occurs. This is the privacy-first approach.',
      },
    },
  },
};

export const InitialPageLoad: Story = {
  args: {
    analyticsConsent: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'On initial page load with consent, the component initializes GA4 and tracks the first page view.',
      },
    },
  },
};

export const ConsentToggle: Story = {
  args: {
    analyticsConsent: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When consent changes from denied to granted, GA4 is initialized and begins tracking. Toggle the consent control to simulate this.',
      },
    },
  },
  render: (args) => {
    const [consent, setConsent] = React.useState(args.analyticsConsent);

    return (
      <div>
        <div className="bg-base-200 mb-4 rounded-lg p-4">
          <h3 className="mb-2 font-bold">Interactive Consent Toggle:</h3>
          <button
            className="btn btn-primary"
            onClick={() => setConsent(!consent)}
          >
            {consent ? 'Revoke Consent' : 'Grant Consent'}
          </button>
          <p className="mt-2 text-sm">
            Current state:{' '}
            {consent ? '✅ Tracking enabled' : '❌ Tracking disabled'}
          </p>
        </div>
        <MockConsentWrapper analyticsConsent={consent}>
          <GoogleAnalytics />
        </MockConsentWrapper>
      </div>
    );
  },
};

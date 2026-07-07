import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import React from 'react';

/**
 * SentryMonitor renders nothing — it initializes Sentry as a side effect when
 * analytics consent is granted and a DSN is configured. These stories document
 * that behavior visually rather than rendering the (invisible) component, which
 * depends on ConsentProvider + the Sentry SDK at runtime.
 */
const SentryMonitorDoc = ({
  analyticsConsent = true,
  dsnConfigured = true,
}: {
  analyticsConsent?: boolean;
  dsnConfigured?: boolean;
}) => {
  const active = analyticsConsent && dsnConfigured;
  return (
    <div className="bg-base-200 rounded-lg p-4">
      <h3 className="mb-2 font-bold">Sentry Monitoring</h3>
      <p>DSN configured: {dsnConfigured ? '✅ Yes' : '❌ No (inert)'}</p>
      <p>Analytics consent: {analyticsConsent ? '✅ Granted' : '❌ Denied'}</p>
      <p className="text-base-content/85 mt-2 text-sm">
        {active
          ? 'Sentry is initialized; handled errors report (PII-scrubbed).'
          : 'Sentry is NOT initialized — no events are sent.'}
      </p>
    </div>
  );
};

const meta: Meta<typeof SentryMonitorDoc> = {
  title: 'Utilities/Monitoring/SentryMonitor',
  component: SentryMonitorDoc,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The SentryMonitor component initializes client-only Sentry error monitoring,
gated on analytics consent (via ConsentContext) and a configured
\`NEXT_PUBLIC_SENTRY_DSN\`. It renders nothing.

## Key Features
- **Privacy-first**: no events until analytics consent is granted
- **Inert without a DSN**: ships disabled until \`NEXT_PUBLIC_SENTRY_DSN\` is set
- **PII scrubbing**: every event is run through a \`beforeSend\` scrubber
- **No session replay / tracing**: never records the encrypted messaging UI
- **Static-export safe**: uses \`@sentry/react\` (client-only), not \`@sentry/nextjs\`

## Usage
\`\`\`tsx
// In app/layout.tsx, beside <GoogleAnalytics />
import SentryMonitor from '@/lib/monitoring/SentryMonitor';

<ConsentProvider>
  <GoogleAnalytics />
  <SentryMonitor />
  {children}
</ConsentProvider>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    analyticsConsent: { control: 'boolean' },
    dsnConfigured: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { analyticsConsent: true, dsnConfigured: true },
};

export const ConsentDenied: Story = {
  args: { analyticsConsent: false, dsnConfigured: true },
};

export const NoDsnConfigured: Story = {
  args: { analyticsConsent: true, dsnConfigured: false },
};

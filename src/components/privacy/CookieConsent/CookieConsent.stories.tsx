import type { Meta, StoryObj } from '@storybook/nextjs';
import { CookieConsent } from './CookieConsent';
import { ConsentProvider } from '../../../contexts/ConsentContext';
import React, { useEffect } from 'react';
import { useConsent } from '../../../contexts/ConsentContext';

const meta: Meta<typeof CookieConsent> = {
  title: 'Features/Privacy/CookieConsent',
  component: CookieConsent,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <ConsentProvider>
        <div
          style={{ minHeight: '100vh', position: 'relative', padding: '2rem' }}
        >
          <div style={{ marginBottom: '2rem' }}>
            <h1>Page Content</h1>
            <p>
              This is the main page content. The cookie banner will appear at
              the bottom.
            </p>
          </div>
          <BannerController />
          <Story />
        </div>
      </ConsentProvider>
    ),
  ],
};

// Helper component to control banner visibility
function BannerController() {
  const { setShowBanner } = useConsent();

  useEffect(() => {
    // Force show banner for stories
    setShowBanner(true);
  }, [setShowBanner]);

  return null;
}

export default meta;
type Story = StoryObj<typeof CookieConsent>;

export const Default: Story = {
  args: {},
};

export const TopPosition: Story = {
  args: {
    position: 'top',
  },
};

export const WithLinks: Story = {
  args: {
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
};

export const CustomContent: Story = {
  args: {
    customContent: (
      <div>
        <h3 className="mb-2 text-lg font-bold">🍪 Cookie Notice</h3>
        <p className="text-sm">
          This website uses cookies to ensure you get the best experience. We
          use essential cookies for site functionality and optional cookies for
          analytics and personalization.
        </p>
      </div>
    ),
  },
};

export const WithCallbacks: Story = {
  args: {
    onAcceptAll: () => console.log('Accept all clicked'),
    onRejectAll: () => console.log('Reject all clicked'),
    onCustomize: () => console.log('Customize clicked'),
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
  parameters: {
    actions: { argTypesRegex: '^on.*' },
  },
};

export const CustomStyling: Story = {
  args: {
    className: 'bg-primary text-primary-content',
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
};

export const MobileView: Story = {
  args: {
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const TabletView: Story = {
  args: {
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

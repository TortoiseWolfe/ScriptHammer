import type { Meta, StoryObj } from '@storybook/nextjs';
import { ConsentModal } from './ConsentModal';
import { ConsentProvider } from '../../../contexts/ConsentContext';
import React, { useEffect } from 'react';
import { useConsent } from '../../../contexts/ConsentContext';

const meta: Meta<typeof ConsentModal> = {
  title: 'Features/Privacy/ConsentModal',
  component: ConsentModal,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <ConsentProvider>
        <div style={{ minHeight: '100vh', position: 'relative' }}>
          <ModalController />
          <Story />
        </div>
      </ConsentProvider>
    ),
  ],
};

// Helper component to control modal visibility
function ModalController() {
  const { setShowModal, setShowBanner } = useConsent();

  useEffect(() => {
    // Force show modal for stories
    setShowModal(true);
    setShowBanner(false);
  }, [setShowModal, setShowBanner]);

  return null;
}

export default meta;
type Story = StoryObj<typeof ConsentModal>;

export const Default: Story = {
  args: {},
};

export const WithLinks: Story = {
  args: {
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
};

export const WithDetails: Story = {
  args: {
    showDetails: true,
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
};

export const WithCallbacks: Story = {
  args: {
    onSave: () => console.log('Preferences saved'),
    onClose: () => console.log('Modal closed'),
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
    showDetails: true,
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
    showDetails: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

export const PrefilledConsent: Story = {
  args: {
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
  decorators: [
    (Story) => {
      const { updateMultiple } = useConsent();

      useEffect(() => {
        // Set some initial consent values
        updateMultiple({
          functional: true,
          analytics: false,
          marketing: true,
        });
      }, [updateMultiple]);

      return <Story />;
    },
  ],
};

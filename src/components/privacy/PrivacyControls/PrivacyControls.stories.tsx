import type { Meta, StoryObj } from '@storybook/nextjs';
import { PrivacyControls } from './PrivacyControls';
import { ConsentProvider } from '../../../contexts/ConsentContext';
import React, { useEffect } from 'react';
import { useConsent } from '../../../contexts/ConsentContext';

const meta: Meta<typeof PrivacyControls> = {
  title: 'Features/Privacy/PrivacyControls',
  component: PrivacyControls,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <ConsentProvider>
        <div style={{ minWidth: '350px' }}>
          <Story />
        </div>
      </ConsentProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PrivacyControls>;

export const Default: Story = {
  args: {},
};

export const Compact: Story = {
  args: {
    compact: true,
  },
};

export const Expanded: Story = {
  args: {
    expanded: true,
  },
};

export const Expandable: Story = {
  args: {
    expandable: true,
  },
};

export const WithConfirmation: Story = {
  args: {
    showConfirmation: true,
  },
};

export const DarkTheme: Story = {
  args: {
    theme: 'dark',
  },
};

export const WithActiveConsent: Story = {
  args: {},
  decorators: [
    (Story) => {
      const { updateMultiple } = useConsent();

      useEffect(() => {
        // Set active consent
        updateMultiple({
          functional: true,
          analytics: true,
          marketing: false,
        });
      }, [updateMultiple]);

      return <Story />;
    },
  ],
};

export const WithFullConsent: Story = {
  args: {
    expanded: true,
  },
  decorators: [
    (Story) => {
      const { acceptAll } = useConsent();

      useEffect(() => {
        // Accept all cookies
        acceptAll();
      }, [acceptAll]);

      return <Story />;
    },
  ],
};

export const WithNoConsent: Story = {
  args: {
    expanded: true,
  },
  decorators: [
    (Story) => {
      const { resetConsent } = useConsent();

      useEffect(() => {
        // Reset to no consent
        resetConsent();
      }, [resetConsent]);

      return <Story />;
    },
  ],
};

export const WithCallbacks: Story = {
  args: {
    onManage: () => console.log('Manage clicked'),
    onRevoke: () => console.log('Revoke clicked'),
  },
  parameters: {
    actions: { argTypesRegex: '^on.*' },
  },
};

export const CustomStyling: Story = {
  args: {
    className: 'bg-primary text-primary-content',
  },
};

export const MobileView: Story = {
  args: {
    expandable: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const TabletView: Story = {
  args: {
    expanded: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

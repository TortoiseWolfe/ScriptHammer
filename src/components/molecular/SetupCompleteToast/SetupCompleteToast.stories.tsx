import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect } from 'react';
import SetupCompleteToast from './SetupCompleteToast';

const meta: Meta<typeof SetupCompleteToast> = {
  title: 'Components/Molecular/SetupCompleteToast',
  component: SetupCompleteToast,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One-shot post-setup toast. Reads and clears sessionStorage.messaging_setup_complete on mount, shows for 10s. Fully self-contained. Extracted from the messages page.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to set the flag before the component mounts
function WithFlag() {
  useEffect(() => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    return () => sessionStorage.removeItem('messaging_setup_complete');
  }, []);
  // Key forces remount after the effect runs so the component sees the flag
  return <SetupCompleteToast key={Date.now()} />;
}

export const Visible: Story = {
  render: () => <WithFlag />,
  parameters: {
    docs: {
      description: {
        story:
          'Toast shown — sessionStorage flag is set before mount. Auto-dismisses after 10s or on Dismiss click.',
      },
    },
  },
};

export const NoFlag: Story = {
  render: () => {
    sessionStorage.removeItem('messaging_setup_complete');
    return (
      <div className="p-8">
        <p className="text-base-content/85">
          Nothing renders — sessionStorage flag not set.
        </p>
        <SetupCompleteToast />
      </div>
    );
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import SetupToast from './SetupToast';

/**
 * Storybook Stories for SetupToast
 *
 * Displays a success toast after messaging encryption setup,
 * reminding the user to save their messaging password.
 */

const meta: Meta<typeof SetupToast> = {
  title: 'Components/Molecular/SetupToast',
  component: SetupToast,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
SetupToast displays a success notification after messaging encryption is configured.

It reminds the user to save their messaging password, which they will need on new devices.

The toast appears at the top-center of the viewport and includes a dismiss button.
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onDismiss: {
      action: 'dismissed',
      description: 'Callback when the toast is dismissed',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default SetupToast appearance
 */
export const Default: Story = {
  args: {
    onDismiss: () => {},
  },
};

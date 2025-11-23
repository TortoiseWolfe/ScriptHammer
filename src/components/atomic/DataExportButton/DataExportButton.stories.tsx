/**
 * Storybook stories for DataExportButton component
 * Task: T193
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from '@storybook/test';
import DataExportButton from './DataExportButton';

const meta: Meta<typeof DataExportButton> = {
  title: 'Components/Atomic/DataExportButton',
  component: DataExportButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'GDPR-compliant data export button. Triggers download of all user data in JSON format with decrypted messages. Part of Phase 9: GDPR Compliance (Task T186).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onExportComplete: {
      description: 'Callback when export completes successfully',
    },
    onExportError: {
      description: 'Callback when export fails',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onExportComplete: fn(),
    onExportError: fn(),
  },
};

export const WithCallbacks: Story = {
  args: {
    onExportComplete: () => {
      console.log('Export completed successfully');
      alert('Export completed! Check your downloads folder.');
    },
    onExportError: (error) => {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    },
  },
};

export const WithCustomStyling: Story = {
  args: {
    className: 'w-full',
    onExportComplete: fn(),
    onExportError: fn(),
  },
};

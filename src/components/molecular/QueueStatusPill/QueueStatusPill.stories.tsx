import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import QueueStatusPill from './QueueStatusPill';

/**
 * QueueStatusPill composes the offline-queue status indicator with a
 * storage-quota warning. In Storybook the live `useOfflineQueue` hook and the
 * StorageManager API drive the rendering; the storage warning only appears when
 * the browser reports usage at/over 80% of quota. See the unit tests for the
 * warning-state coverage (storage is mocked there).
 */
const meta: Meta<typeof QueueStatusPill> = {
  title: 'Components/Molecular/QueueStatusPill',
  component: QueueStatusPill,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'QueueStatusPill component for the molecular category — offline-queue status + storage-quota warning.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showRetryButton: {
      control: 'boolean',
      description: 'Show retry button for failed messages',
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
    showRetryButton: true,
  },
};

import type React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PlaceholderMark from './PlaceholderMark';

const meta = {
  title: 'Components/Atomic/PlaceholderMark',
  component: PlaceholderMark,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story: () => React.JSX.Element) => (
      <div className="text-base-content h-48 w-48">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlaceholderMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What a project renders until it has a mark of its own. */
export const Default: Story = { args: {} };

/** Two words give two letters. */
export const TwoInitials: Story = { args: { initials: 'GD' } };

/** A single-word name keeps one, at a larger size. */
export const SingleInitial: Story = { args: { initials: 'W' } };

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import EmptyConversationPrompt from './EmptyConversationPrompt';

const meta: Meta<typeof EmptyConversationPrompt> = {
  title: 'Components/Molecular/EmptyConversationPrompt',
  component: EmptyConversationPrompt,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Placeholder shown when no conversation is selected. Pure presentational. The mobile-only Open Sidebar button appears when onOpenSidebar is provided.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[600px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithOpenSidebarButton: Story = {
  args: {
    onOpenSidebar: fn(),
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story:
          'On mobile viewports, an Open Sidebar button is shown. The button has md:hidden so it disappears at ≥768px.',
      },
    },
  },
};

export const ThemeShowcase: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-4">
      <div className="bg-base-100 h-[300px] rounded-lg">
        <EmptyConversationPrompt />
      </div>
      <div className="bg-base-300 h-[300px] rounded-lg">
        <EmptyConversationPrompt />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

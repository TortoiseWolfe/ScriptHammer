import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SetupBanner } from './SetupBanner';

const meta = {
  title: 'Components/SetupBanner',
  component: SetupBanner,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A dismissible banner that appears when Supabase is not configured. Helps new users understand that setup is required.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    message: {
      control: 'text',
      description: 'Message to display in the banner',
    },
    docsUrl: {
      control: 'text',
      description: 'URL to setup documentation',
    },
    show: {
      control: 'boolean',
      description: 'Force show/hide the banner',
    },
  },
} satisfies Meta<typeof SetupBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    show: true,
  },
};

export const CustomMessage: Story = {
  args: {
    show: true,
    message: 'Database connection required. Please configure your environment.',
  },
};

export const CustomDocsUrl: Story = {
  args: {
    show: true,
    docsUrl: 'https://docs.example.com/setup',
  },
};

export const NoDocsLink: Story = {
  args: {
    show: true,
    docsUrl: '',
  },
};

export const Hidden: Story = {
  args: {
    show: false,
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SetupBanner } from './SetupBanner';

const meta = {
  title: 'Components/Atomic/SetupBanner',
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

export const ThemeShowcase: Story = {
  args: {
    show: true,
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          Banner Variants
        </h3>
        <div className="flex flex-col gap-3">
          <SetupBanner show={true} />
          <SetupBanner
            show={true}
            message="Custom warning message for your project."
          />
          <SetupBanner show={true} docsUrl="" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          On Surfaces
        </h3>
        <div className="bg-base-100 rounded-lg p-4">
          <span className="text-base-content/80 mb-2 block text-sm">
            base-100:
          </span>
          <SetupBanner show={true} />
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <span className="text-base-content/80 mb-2 block text-sm">
            base-200:
          </span>
          <SetupBanner show={true} />
        </div>
        <div className="bg-neutral rounded-lg p-4">
          <span className="text-neutral-content/80 mb-2 block text-sm">
            neutral:
          </span>
          <SetupBanner show={true} />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

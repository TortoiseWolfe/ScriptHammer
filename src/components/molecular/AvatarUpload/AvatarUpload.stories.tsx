import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AvatarUpload from './AvatarUpload';

const meta: Meta<typeof AvatarUpload> = {
  title: 'Components/Molecular/AvatarUpload',
  component: AvatarUpload,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Avatar upload component with crop interface. Allows users to upload JPEG/PNG/WebP images under 5MB with interactive cropping.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onUploadComplete: {
      action: 'uploaded',
      description: 'Callback when avatar upload completes successfully',
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
    onUploadComplete: (url: string) => {
      console.log('Avatar uploaded:', url);
    },
  },
};

export const WithCustomClass: Story = {
  args: {
    className: 'w-full max-w-md',
    onUploadComplete: (url: string) => {
      console.log('Avatar uploaded:', url);
    },
  },
};

export const ThemeShowcase: Story = {
  args: {
    onUploadComplete: () => {},
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <AvatarUpload {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <AvatarUpload {...args} />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <AvatarUpload {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

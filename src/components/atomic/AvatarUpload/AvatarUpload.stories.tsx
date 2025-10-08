import type { Meta, StoryObj } from '@storybook/nextjs';
import AvatarUpload from './AvatarUpload';

const meta: Meta<typeof AvatarUpload> = {
  title: 'Components/Atomic/AvatarUpload',
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

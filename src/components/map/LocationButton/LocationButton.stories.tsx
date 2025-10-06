import type { Meta, StoryObj } from '@storybook/nextjs';
import { LocationButton } from './LocationButton';

const meta = {
  title: 'Features/Map/LocationButton',
  component: LocationButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onClick: () => console.log('Location button clicked'),
  },
  argTypes: {
    onClick: { action: 'clicked' },
    loading: {
      control: 'boolean',
      description: 'Shows loading state',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
    hasLocation: {
      control: 'boolean',
      description: 'Whether location has been obtained',
    },
    permissionState: {
      control: 'select',
      options: ['prompt', 'granted', 'denied'],
      description: 'Browser permission state',
    },
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
      description: 'Button variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
  },
} satisfies Meta<typeof LocationButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const HasLocation: Story = {
  args: {
    hasLocation: true,
  },
};

export const PermissionDenied: Story = {
  args: {
    permissionState: 'denied',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
  },
};

export const LoadingWithLocation: Story = {
  args: {
    loading: true,
    hasLocation: true,
  },
};

export const CustomClass: Story = {
  args: {
    className: 'shadow-xl',
  },
};

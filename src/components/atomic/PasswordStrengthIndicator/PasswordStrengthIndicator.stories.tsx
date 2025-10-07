import type { Meta, StoryObj } from '@storybook/nextjs';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

const meta: Meta<typeof PasswordStrengthIndicator> = {
  title: 'Components/Atomic/PasswordStrengthIndicator',
  component: PasswordStrengthIndicator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Visual indicator showing password strength with color-coded bar. Returns null if password is empty.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    password: {
      control: 'text',
      description: 'Password to evaluate',
    },
    onChange: {
      action: 'strength-changed',
      description: 'Callback when strength changes',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WeakPassword: Story = {
  args: {
    password: 'abc',
  },
};

export const MediumPassword: Story = {
  args: {
    password: 'Password1',
  },
};

export const StrongPassword: Story = {
  args: {
    password: 'MyP@ssw0rd123!',
  },
};

export const EmptyPassword: Story = {
  args: {
    password: '',
  },
};

export const WithCustomClass: Story = {
  args: {
    password: 'MyP@ssw0rd123!',
    className: 'mt-4',
  },
};

export const Interactive: Story = {
  args: {
    password: 'test',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Try changing the password in the controls to see different strength levels.',
      },
    },
  },
};

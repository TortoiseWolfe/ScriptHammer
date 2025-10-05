import type { Meta, StoryObj } from '@storybook/nextjs';
import EmailVerificationNotice from './EmailVerificationNotice';

const meta: Meta<typeof EmailVerificationNotice> = {
  title: 'Components/Molecular/EmailVerificationNotice',
  component: EmailVerificationNotice,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'EmailVerificationNotice component for the molecular category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Content to display inside the component',
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
    children: 'Default EmailVerificationNotice content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'EmailVerificationNotice with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};

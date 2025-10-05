import type { Meta, StoryObj } from '@storybook/nextjs';
import AccountSettings from './AccountSettings';

const meta: Meta<typeof AccountSettings> = {
  title: 'Components/Molecular/AccountSettings',
  component: AccountSettings,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'AccountSettings component for the molecular category.',
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
    children: 'Default AccountSettings content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'AccountSettings with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};

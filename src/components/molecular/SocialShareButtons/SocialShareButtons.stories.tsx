import type { Meta, StoryObj } from '@storybook/nextjs';
import SocialShareButtons from './SocialShareButtons';

const meta: Meta<typeof SocialShareButtons> = {
  title: 'Components/Molecular/SocialShareButtons',
  component: SocialShareButtons,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SocialShareButtons component for the molecular category.',
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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};

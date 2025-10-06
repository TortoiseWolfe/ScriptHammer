import type { Meta, StoryObj } from '@storybook/nextjs';
import OAuthButtons from './OAuthButtons';

const meta: Meta<typeof OAuthButtons> = {
  title: 'Features/Authentication/OAuthButtons',
  component: OAuthButtons,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Social OAuth login buttons (GitHub, Google).',
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/sign-in',
        query: {},
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

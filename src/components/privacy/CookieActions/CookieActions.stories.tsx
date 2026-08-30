import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CookieActions } from './CookieActions';

const meta = {
  title: 'Privacy/CookieActions',
  component: CookieActions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The action row at the top of the policy page. Opens the consent modal, and links onward to the related policies. Takes no props — it reads the consent context.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CookieActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

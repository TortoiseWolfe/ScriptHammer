import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AdminOrdersPanel from './AdminOrdersPanel';

const meta: Meta<typeof AdminOrdersPanel> = {
  title: 'Components/Organisms/AdminOrdersPanel',
  component: AdminOrdersPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Reads live orders on the signed-in admin’s own session (the `Admin can ' +
          'view all orders` RLS policy). In Storybook there is no session, so it ' +
          'renders its empty or error state — that is the honest preview rather ' +
          'than a mocked one that would not match production.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AdminOrdersPanel>;

export const Default: Story = {};
export const SinglePage: Story = { args: { limit: 5 } };

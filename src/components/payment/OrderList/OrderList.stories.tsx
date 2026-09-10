import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import OrderList from './OrderList';
import {
  buyerOrders,
  depositOrder,
  retiredSkuOrder,
} from '../__fixtures__/orders';

/**
 * Every story passes `orders` explicitly. Left to fetch, the component would sit on
 * "Loading your orders…" forever in Storybook — there is no session and no backend — which
 * is exactly the state that teaches a reviewer nothing.
 */
const meta = {
  title: 'Features/Payment/OrderList',
  component: OrderList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof OrderList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full spread: unconfirmed, deposit, retired SKU, delivered. */
export const Default: Story = {
  args: { orders: buyerOrders },
};

/** Half of a $1,200 package charged, the rest named as invoiced separately. */
export const DepositWithBalance: Story = {
  args: { orders: [depositOrder] },
};

/** The catalog row is unreadable through RLS, so the SKU stands in for the name. */
export const RetiredSku: Story = {
  args: { orders: [retiredSkuOrder] },
};

/** What most signed-in visitors will actually see. */
export const NoOrders: Story = {
  args: { orders: [] },
};

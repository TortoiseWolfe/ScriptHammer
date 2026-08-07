import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CheckoutSummary from './CheckoutSummary';
import { landingPage, discovery } from '../__fixtures__/products';

const meta: Meta<typeof CheckoutSummary> = {
  title: 'Features/Payment/CheckoutSummary',
  component: CheckoutSummary,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof CheckoutSummary>;

export const DepositSplit: Story = {
  args: { product: landingPage, amountDueNow: 60000 },
};
export const PaidInFull: Story = {
  args: { product: discovery, amountDueNow: 25000 },
};
export const Loading: Story = { args: { product: null, amountDueNow: null } };

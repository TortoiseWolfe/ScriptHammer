import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BookingStep from './BookingStep';

const meta: Meta<typeof BookingStep> = {
  title: 'Features/Payment/BookingStep',
  component: BookingStep,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof BookingStep>;

export const Default: Story = {
  args: {
    orderId: 'o_7fd2c1a4',
    buyerName: 'Rigo',
    buyerEmail: 'rigo@warriorroofing.example',
    productName: 'Landing Page',
  },
};
export const WithoutBuyerDetails: Story = { args: { orderId: 'o_7fd2c1a4' } };

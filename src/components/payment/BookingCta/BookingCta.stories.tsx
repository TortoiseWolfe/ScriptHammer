import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BookingCta from './BookingCta';

const meta: Meta<typeof BookingCta> = {
  title: 'Features/Payment/BookingCta',
  component: BookingCta,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof BookingCta>;

/** On /pricing, beside a specific package. */
export const WithProduct: Story = {
  args: { source: 'pricing', productId: 'svc-landing' },
};

/** A general "book a call" with no SKU behind it. */
export const General: Story = {
  args: { source: 'pricing' },
};

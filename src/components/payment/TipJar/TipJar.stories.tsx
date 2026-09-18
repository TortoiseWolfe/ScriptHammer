import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import TipJar from './TipJar';

const meta: Meta<typeof TipJar> = {
  title: 'Features/Payment/TipJar',
  component: TipJar,
  parameters: {
    docs: {
      description: {
        component:
          'Pay-what-you-want for the `tip-jar` SKU. The amount is validated here for a fast message and again in `create-order`, which is the only check that counts.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TipJar>;

export const Default: Story = {};

/** What a rejected amount looks like. Type 0 and press Send a tip. */
export const ValidationError: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Out-of-range input shows an alert wired to the field via aria-describedby. The shake is suppressed entirely under reduced motion rather than started and hidden.',
      },
    },
  },
};

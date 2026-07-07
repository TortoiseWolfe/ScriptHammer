/**
 * SwitchProviderPanel Storybook stories
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SwitchProviderPanel } from './SwitchProviderPanel';

const meta: Meta<typeof SwitchProviderPanel> = {
  title: 'Features/Payment/SwitchProviderPanel',
  component: SwitchProviderPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders inside the failed-state block on /payment-result. Lets the user switch payment provider after a card decline. Reuses PaymentButton; preserves audit chain via parent_intent_id.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SwitchProviderPanel>;

/** Storybook needs a real parent intent to render the success path; in the
 * iframe it stays in the loading state. The interesting visuals are
 * easier to verify by toggling failure scenarios in the running app at
 * /payment-result?id=<failed-intent-id>. */
export const Default: Story = {
  args: {
    parentIntentId: '00000000-0000-0000-0000-000000000000',
  },
};

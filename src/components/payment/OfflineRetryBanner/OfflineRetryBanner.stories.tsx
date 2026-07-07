/**
 * OfflineRetryBanner Storybook stories
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OfflineRetryBanner } from './OfflineRetryBanner';

const meta: Meta<typeof OfflineRetryBanner> = {
  title: 'Features/Payment/OfflineRetryBanner',
  component: OfflineRetryBanner,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders on the payment-result page when the user is offline or when queued payments are still syncing. Stays silent in the online + empty-queue steady state.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof OfflineRetryBanner>;

/** Default render — relies on real online-status + empty queue. In the
 * Storybook iframe this typically renders nothing (the steady state). */
export const Default: Story = {};

/** Story name = scenario; the actual offline / queued visuals are easier
 * to verify by toggling devtools "Offline" while viewing the running app
 * at /payment-result, since this component reads navigator.onLine and
 * an IndexedDB-backed queue that Storybook doesn't simulate. */

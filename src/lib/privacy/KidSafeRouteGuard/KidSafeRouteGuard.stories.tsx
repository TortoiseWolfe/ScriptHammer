import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import React from 'react';
import KidSafeRouteGuard from './KidSafeRouteGuard';

/**
 * The guard renders nothing, so the story documents what it does rather than how it looks.
 */
const Explain = () => (
  <div className="bg-base-200 rounded-box max-w-prose p-4">
    <h3 className="mb-2 font-bold">Kid-safe route guard</h3>
    <p className="text-sm">
      When a client-side navigation reaches a kid-safe route such as /band and a
      tracker has already loaded in this document, the page reloads, so the
      kid-safe route gets a document that never held a tracker.
    </p>
    <KidSafeRouteGuard />
  </div>
);

const meta = {
  title: 'Utilities/Privacy/KidSafeRouteGuard',
  component: Explain,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Explain>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

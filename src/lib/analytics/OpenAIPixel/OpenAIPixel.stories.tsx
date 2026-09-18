import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import React from 'react';
import OpenAIPixel from './OpenAIPixel';

/**
 * The pixel renders no visible UI, so these stories document its two states rather than its
 * appearance — which is the useful thing to be able to see at a glance.
 */
const Explain = ({
  granted,
  configured,
}: {
  granted: boolean;
  configured: boolean;
}) => (
  <div className="bg-base-200 rounded-box max-w-prose p-4">
    <h3 className="mb-2 font-bold">OpenAI Ads pixel</h3>
    <p>Marketing consent: {granted ? '✅ granted' : '❌ denied'}</p>
    <p>Pixel id configured: {configured ? '✅ yes' : '❌ no'}</p>
    <p className="mt-2 text-sm">
      {granted && configured
        ? 'The pixel loads and captures the ad click id into a first-party cookie.'
        : 'Nothing is loaded and no identifier is held. This is the default state.'}
    </p>
    <OpenAIPixel />
  </div>
);

const meta = {
  title: 'Utilities/Analytics/OpenAIPixel',
  component: Explain,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Explain>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default for every new visitor: consent denied, so nothing loads. */
export const ConsentDenied: Story = {
  args: { granted: false, configured: true },
};

/** After the visitor accepts marketing cookies. */
export const ConsentGranted: Story = {
  args: { granted: true, configured: true },
};

/** A fork that has not set NEXT_PUBLIC_OPENAI_PIXEL_ID — the correct no-op. */
export const NotConfigured: Story = {
  args: { granted: true, configured: false },
};

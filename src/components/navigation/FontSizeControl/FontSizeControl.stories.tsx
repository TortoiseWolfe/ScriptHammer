import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FontSizeControl, TextSettingsPanel } from './FontSizeControl';

const meta = {
  title: 'Features/Navigation/FontSizeControl',
  component: FontSizeControl,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Text size and line spacing, reading and writing through `AccessibilityContext`. Two exports: `TextSettingsPanel` is the bare controls — which is what `GlobalNav` mounts, so that `Display ▾` does not end up with a dropdown inside a dropdown — and `FontSizeControl` is that panel behind its own trigger.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FontSizeControl>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The trigger plus panel. Its `:focus-within` dropdown is a known #378 gap. */
export const Default: Story = {};

/** What the nav actually renders, inside `Display ▾`. */
export const PanelOnly: StoryObj = {
  render: () => (
    <div className="bg-base-100 rounded-box w-56 p-4 shadow-lg sm:w-72">
      <TextSettingsPanel />
    </div>
  ),
};

/** At 360px the panel must stay inside the viewport. */
export const NarrowViewport: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

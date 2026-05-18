import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FallbackPanel from './FallbackPanel';

const meta = {
  title: 'Features/Game/FallbackPanel',
  component: FallbackPanel,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Fallback UI rendered when WebGL is unavailable or the GPU context is lost (FR-008). Themed silhouette of the brand sculpt (cog ring + script-tag brackets) in DaisyUI base-content color, plus a 44×44 keyboard-focusable Retry button.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onRetry: {
      action: 'retry',
      description: 'Callback fired when the user clicks the Retry button.',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes.',
    },
  },
} satisfies Meta<typeof FallbackPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const DarkTheme: Story = {
  args: {},
  decorators: [
    (StoryFn) => (
      <div data-theme="scripthammer-dark" style={{ padding: '2rem' }}>
        <StoryFn />
      </div>
    ),
  ],
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story:
          'Verifies the inline silhouette SVG and panel chrome recolor correctly under the `scripthammer-dark` DaisyUI theme. The silhouette uses `hsl(var(--bc) / 0.6)` so it tracks base-content color across all 32 themes.',
      },
    },
  },
};

export const LightTheme: Story = {
  args: {},
  decorators: [
    (StoryFn) => (
      <div data-theme="cupcake" style={{ padding: '2rem' }}>
        <StoryFn />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Same panel under the `cupcake` light-pastel theme — silhouette inverts to a darker base-content tone for adequate contrast.',
      },
    },
  },
};

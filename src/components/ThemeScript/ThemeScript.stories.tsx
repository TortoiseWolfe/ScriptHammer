import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ThemeScript from './ThemeScript';

const meta = {
  title: 'Components/ThemeScript',
  component: ThemeScript,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Applies the saved or system theme **before first paint**, so the page never flashes the wrong theme. Renders a single inline `<script>` and nothing visible — the story frame is intentionally blank. Mounted once in `app/layout.tsx`; it is here as documentation of an app-shell component, not as something to look at.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ThemeScript>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

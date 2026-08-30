import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AccessibilityScript from './AccessibilityScript';

const meta = {
  title: 'Components/AccessibilityScript',
  component: AccessibilityScript,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Applies the visitor’s font size, line height and font family **before first paint** (#388), so a long page does not re-typeset on hydration. Reads storage only where consent allows. Renders a single inline `<script>` and nothing visible — the blank frame is correct.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AccessibilityScript>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ThemeSwitcher } from './ThemeSwitcher';

const meta = {
  title: 'Features/Theme/ThemeSwitcher',
  component: ThemeSwitcher,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The full theme grid used on `/themes`. Each swatch previews itself via its own `data-theme`, and the count in the description is derived from `@/config/themes` rather than written down (#514). Choosing a theme applies it to the document and reports the change to analytics.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ThemeSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

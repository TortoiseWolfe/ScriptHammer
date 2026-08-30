import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Footer } from './Footer';

const meta = {
  title: 'Layout/Footer',
  component: Footer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The site footer, mounted once in `app/layout.tsx`. Takes no props — it renders `FOOTER_LINKS` from config. Carries `data-site-footer` so the twin routes can hide it and substitute their own compact strip (#301).',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

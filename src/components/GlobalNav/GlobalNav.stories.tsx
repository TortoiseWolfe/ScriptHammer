import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GlobalNav } from './GlobalNav';

const meta = {
  title: 'Components/GlobalNav',
  component: GlobalNav,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The site header, mounted once in `layout.tsx`. All four of its popovers are React-owned rather than DaisyUI `:focus-within`, because the keyboard contract needs Escape to return focus to the trigger — with `:focus-within` the trigger lives inside `.dropdown`, so doing that re-opens the panel on the same frame. `Display ▾` is a `role="group"` disclosure since it holds controls; `Demos ▾` is a real `role="menu"` since it holds destinations. The account menu and the mobile hamburger are `role="group"` too (#1018): each holds a heading and a button as well as links, so a menu would misdescribe them.\n\nPanels are mounted only while open, and close on Escape, on an outside press, on tab-out, and when a destination inside them is chosen.\n\nIt reads auth, profile, unread count and admin status from context, so these stories show it signed out. `data-global-nav` is a styling hook for the twin routes’ glass treatment, not a test id.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GlobalNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed out, at desktop width: the full rail is visible. */
export const Default: Story = {};

/** Below `lg` the rail is replaced by the hamburger. */
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

/** The width where the rail appears; worth checking nothing collides. */
export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

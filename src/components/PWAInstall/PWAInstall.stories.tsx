import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PWAInstall from './PWAInstall';

const meta = {
  title: 'Components/PWAInstall',
  component: PWAInstall,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Registers the service worker and offers the install prompt. It renders **nothing** unless the browser has fired `beforeinstallprompt` — so on a desktop Storybook it is usually invisible, which is correct rather than broken. Add `?pwa-debug=true` to the URL to force the pill up. It is fixed to the top right of the viewport, so these stories are full-screen.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PWAInstall>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Its normal state on any browser that has not offered an install prompt: an
 * empty frame. Nothing is wrong.
 */
export const Default: Story = {};

/**
 * The pill, forced up via the component's own debug flag. Storybook does not
 * carry query strings into the iframe, so this decorator sets one.
 */
export const Forced: Story = {
  decorators: [
    (Story) => {
      window.history.replaceState({}, '', '?pwa-debug=true');
      return <Story />;
    },
  ],
};

/** How it looks after someone minimises it — a single circular trigger. */
export const Minimized: Story = {
  decorators: [
    (Story) => {
      window.history.replaceState({}, '', '?pwa-debug=true');
      localStorage.setItem('pwa-install-minimized', 'true');
      return <Story />;
    },
  ],
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CaptchaWidget from './CaptchaWidget';

const meta: Meta<typeof CaptchaWidget> = {
  title: 'Features/Authentication/CaptchaWidget',
  component: CaptchaWidget,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Cloudflare Turnstile bot protection for the sign-up form (#353).',
          '',
          '**This renders nothing unless `NEXT_PUBLIC_CAPTCHA_SITE_KEY` is set** —',
          'that is deliberate, so forks and local dev are unaffected and the',
          'client can ship before Supabase-side enforcement is switched on.',
          'In Storybook the key is normally absent, so the stories below show an',
          'empty frame; that IS the unconfigured behaviour.',
          '',
          'The widget is not a security boundary on its own — Supabase verifies',
          'the token server-side when `SECURITY_CAPTCHA_ENABLED` is true.',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onToken: {
      action: 'token',
      description:
        'Receives the token when solved, or null when it expires/errors.',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default. Renders the challenge only when a site key is configured. */
export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'p-4 rounded',
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import EmailProviderHealth from './EmailProviderHealth';
import type { ProviderStatus } from '@/utils/email/types';

const healthyProviders: ProviderStatus[] = [
  {
    name: 'Web3Forms',
    priority: 1,
    available: true,
    failures: 0,
    healthy: true,
  },
  { name: 'EmailJS', priority: 2, available: true, failures: 0, healthy: true },
];

const degradedProviders: ProviderStatus[] = [
  {
    name: 'Web3Forms',
    priority: 1,
    available: true,
    failures: 1,
    healthy: true,
  },
  {
    name: 'EmailJS',
    priority: 2,
    available: false,
    failures: 5,
    healthy: false,
    lastError: 'HTTP 429: rate limit exceeded',
  },
];

const okRateLimit = {
  remaining: 4,
  resetTime: Date.parse('2026-06-06T12:00:00Z'),
  isLimited: false,
};

const meta: Meta<typeof EmailProviderHealth> = {
  title: 'Components/Organisms/EmailProviderHealth',
  component: EmailProviderHealth,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Admin-facing health dashboard for the dual-provider email abstraction (#34).',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: { providers: healthyProviders, rateLimitStatus: okRateLimit },
};

export const Degraded: Story = {
  args: {
    providers: degradedProviders,
    rateLimitStatus: {
      remaining: 0,
      resetTime: okRateLimit.resetTime,
      isLimited: true,
    },
  },
};

export const Loading: Story = {
  args: { providers: [], rateLimitStatus: null, isLoading: true },
};

export const NoProviders: Story = {
  args: { providers: [], rateLimitStatus: okRateLimit },
};

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmailProviderHealth from './EmailProviderHealth';
import type { ProviderStatus } from '@/utils/email/types';

const providers: ProviderStatus[] = [
  {
    name: 'Web3Forms',
    priority: 1,
    available: true,
    failures: 0,
    healthy: true,
  },
  {
    name: 'EmailJS',
    priority: 2,
    available: false,
    failures: 4,
    healthy: false,
    lastError: 'Network timeout',
  },
];

const rateLimitStatus = {
  remaining: 3,
  resetTime: new Date('2026-06-06T12:00:00Z').getTime(),
  isLimited: false,
};

describe('EmailProviderHealth', () => {
  it('renders a loading skeleton when isLoading', () => {
    render(
      <EmailProviderHealth providers={[]} rateLimitStatus={null} isLoading />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getByText(/loading email provider health/i)
    ).toBeInTheDocument();
  });

  it('renders one card per provider with priority and failures', () => {
    render(
      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={rateLimitStatus}
      />
    );
    expect(screen.getByTestId('email-provider-Web3Forms')).toBeInTheDocument();
    expect(screen.getByTestId('email-provider-EmailJS')).toBeInTheDocument();
    expect(screen.getByText('Priority 1')).toBeInTheDocument();
    expect(screen.getByText('Priority 2')).toBeInTheDocument();
  });

  it('shows Healthy/Unhealthy badges per provider', () => {
    render(
      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={rateLimitStatus}
      />
    );
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Unhealthy')).toBeInTheDocument();
  });

  it('surfaces a provider lastError when present', () => {
    render(
      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={rateLimitStatus}
      />
    );
    expect(screen.getByText(/network timeout/i)).toBeInTheDocument();
  });

  it('renders the rate-limit remaining count and OK status', () => {
    render(
      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={rateLimitStatus}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('shows a Rate limited badge when isLimited', () => {
    render(
      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={{ ...rateLimitStatus, isLimited: true, remaining: 0 }}
      />
    );
    expect(screen.getByText('Rate limited')).toBeInTheDocument();
  });

  it('shows an empty-state alert when no providers are configured', () => {
    render(
      <EmailProviderHealth providers={[]} rateLimitStatus={rateLimitStatus} />
    );
    expect(
      screen.getByText(/no email providers configured/i)
    ).toBeInTheDocument();
  });
});

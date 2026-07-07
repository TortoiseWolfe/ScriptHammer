import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import EmailProviderHealth from './EmailProviderHealth';
import type { ProviderStatus } from '@/utils/email/types';

expect.extend(toHaveNoViolations);

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
    failures: 3,
    healthy: false,
    lastError: 'Network timeout',
  },
];

const rateLimitStatus = {
  remaining: 2,
  resetTime: Date.parse('2026-06-06T12:00:00Z'),
  isLimited: false,
};

describe('EmailProviderHealth Accessibility', () => {
  it('should have no accessibility violations (with data)', async () => {
    const { container } = render(
      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={rateLimitStatus}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (empty + loading states)', async () => {
    const empty = render(
      <EmailProviderHealth providers={[]} rateLimitStatus={rateLimitStatus} />
    );
    expect(await axe(empty.container)).toHaveNoViolations();

    const loading = render(
      <EmailProviderHealth providers={[]} rateLimitStatus={null} isLoading />
    );
    expect(await axe(loading.container)).toHaveNoViolations();
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(
      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={rateLimitStatus}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});

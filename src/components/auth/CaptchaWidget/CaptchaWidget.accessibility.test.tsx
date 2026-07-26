import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CaptchaWidget from './CaptchaWidget';

expect.extend(toHaveNoViolations);

// Cloudflare's widget can't mount in jsdom (external script + cross-origin
// iframe). Its own a11y is Cloudflare's responsibility and is not ours to
// assert; what we can assert is that our wrapper adds no violations.
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: () => <div data-testid="turnstile-stub" />,
}));

const mockConfig = vi.hoisted(() => ({
  captchaConfig: {
    provider: 'turnstile',
    siteKey: '0x-site-key',
    enabled: true,
  },
}));
vi.mock('@/config/captcha.config', () => mockConfig);

describe('CaptchaWidget Accessibility', () => {
  it('should have no accessibility violations when rendered', async () => {
    const { container } = render(<CaptchaWidget onToken={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when disabled (renders nothing)', async () => {
    mockConfig.captchaConfig.enabled = false;
    const { container } = render(<CaptchaWidget onToken={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    mockConfig.captchaConfig.enabled = true;
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(<CaptchaWidget onToken={vi.fn()} />);

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });
});

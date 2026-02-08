import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { CountdownBanner } from './CountdownBanner';

// Mock date to within season so the banner renders for a11y tests
function mockInSeason() {
  vi.useFakeTimers({
    now: new Date('2025-11-15T12:00:00').getTime(),
    shouldAdvanceTime: true,
  });
}

describe('CountdownBanner Accessibility', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have no accessibility violations', async () => {
    mockInSeason();
    const { container } = render(<CountdownBanner />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    mockInSeason();
    const { container } = render(<CountdownBanner />);

    // Add specific ARIA attribute tests based on component type
    // Example: const button = container.querySelector('button');
    // expect(button).toHaveAttribute('aria-label');
  });

  it('should be keyboard navigable', () => {
    mockInSeason();
    const { container } = render(<CountdownBanner />);

    // Test keyboard navigation
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    mockInSeason();
    const { container } = render(<CountdownBanner />);

    // Axe will check color contrast
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    mockInSeason();
    const { container } = render(<CountdownBanner />);

    // Check for screen reader support
    // Example: Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});

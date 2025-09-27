import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import SocialShareButtons from './SocialShareButtons';
import type { ShareOptions } from '@/types/social';

describe('SocialShareButtons Accessibility', () => {
  const mockShareOptions: ShareOptions = {
    title: 'Test Title',
    text: 'Test text',
    url: 'https://example.com',
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    // Add specific tests
  });

  it('should be keyboard navigable', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});

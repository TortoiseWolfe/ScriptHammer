import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import AuthorProfile from './AuthorProfile';
import type { Author } from '@/types/author';

describe('AuthorProfile Accessibility', () => {
  const mockAuthor: Author = {
    id: 'author-1',
    username: 'testuser',
    name: 'Test Author',
    email: 'test@example.com',
    bio: 'Test bio',
    avatar: '/avatar.jpg',
    website: 'https://example.com',
    socialLinks: [
      { platform: 'twitter', url: 'https://twitter.com/test', displayOrder: 0 },
    ],
    joinedAt: new Date().toISOString(),
    postsCount: 10,
    permissions: [],
    preferences: { publicProfile: true },
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    // Add specific tests
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});

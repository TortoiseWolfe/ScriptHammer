import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import BlogPostCard from './BlogPostCard';
import type { BlogPost } from '@/types/blog';

describe('BlogPostCard Accessibility', () => {
  const mockPost: BlogPost = {
    id: 'post-1',
    slug: 'test-post',
    title: 'Test Post',
    content: 'Test content',
    excerpt: 'Test excerpt',
    status: 'published',
    version: 1,
    syncStatus: 'synced',
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: { id: 'author-1', name: 'Test Author' },
    metadata: {
      tags: ['test'],
      categories: [],
      readingTime: 5,
      wordCount: 100,
      showToc: true,
      showAuthor: true,
      showShareButtons: true,
    },
    seo: { title: 'Test Post', description: 'Test excerpt' },
    offline: { isOfflineDraft: false, lastSyncedAt: new Date().toISOString() },
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    // Add specific tests
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});

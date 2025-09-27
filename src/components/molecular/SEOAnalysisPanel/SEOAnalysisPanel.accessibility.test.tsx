import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import SEOAnalysisPanel from './SEOAnalysisPanel';
import type { BlogPost } from '@/types/blog';

expect.extend(toHaveNoViolations);

describe('SEOAnalysisPanel Accessibility', () => {
  const mockPost: BlogPost = {
    id: 'test-post',
    slug: 'test-slug',
    title: 'Test Blog Post',
    content:
      'This is test content for the blog post with enough words to make it substantial.',
    excerpt: 'Test excerpt',
    status: 'published',
    publishedAt: '2024-01-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
    syncStatus: 'synced',
    offline: {
      isOfflineDraft: false,
    },
    author: {
      id: 'author1',
      name: 'Test Author',
    },
    metadata: {
      tags: ['test', 'accessibility'],
      categories: ['testing'],
      readingTime: 1,
      wordCount: 100,
    },
    seo: {
      title: 'SEO Title for Testing',
      description: 'SEO Description for accessibility testing',
      keywords: ['test', 'seo', 'accessibility'],
    },
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(<SEOAnalysisPanel post={mockPost} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when expanded', async () => {
    const { container } = render(
      <SEOAnalysisPanel post={mockPost} expanded={true} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(
      <SEOAnalysisPanel post={mockPost} expanded={true} />
    );
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');

    // Check that headings exist and follow proper hierarchy
    headings.forEach((heading, index) => {
      if (index > 0) {
        const prevLevel = parseInt(headings[index - 1].tagName[1]);
        const currLevel = parseInt(heading.tagName[1]);
        // Heading levels should not skip (e.g., h2 -> h4)
        expect(currLevel - prevLevel).toBeLessThanOrEqual(1);
      }
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(
      <SEOAnalysisPanel post={mockPost} expanded={true} />
    );
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });
});

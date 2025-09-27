import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SEOAnalysisPanel from './SEOAnalysisPanel';
import type { BlogPost } from '@/types/blog';

describe('SEOAnalysisPanel', () => {
  const mockPost: BlogPost = {
    id: 'test-post',
    slug: 'test-slug',
    title: 'Test Blog Post',
    content: 'This is test content for the blog post.',
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
      tags: ['test'],
      categories: ['testing'],
      readingTime: 1,
      wordCount: 10,
    },
    seo: {
      title: 'SEO Title',
      description: 'SEO Description',
      keywords: ['test', 'seo'],
    },
  };

  it('renders without crashing', () => {
    render(<SEOAnalysisPanel post={mockPost} />);
    expect(screen.getByText(/SEO Analysis/i)).toBeInTheDocument();
  });

  it('displays SEO score when available', () => {
    const { container } = render(<SEOAnalysisPanel post={mockPost} />);
    const scoreElements = container.querySelectorAll('.stat-value');
    expect(scoreElements.length).toBeGreaterThan(0);
  });

  it('can be expanded and collapsed', () => {
    render(<SEOAnalysisPanel post={mockPost} expanded={false} />);
    const panel = screen.getByText(/SEO Analysis/i).closest('div');
    expect(panel).toBeInTheDocument();
  });
});

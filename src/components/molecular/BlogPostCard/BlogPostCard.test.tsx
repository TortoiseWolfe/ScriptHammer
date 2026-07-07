import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BlogPostCard from './BlogPostCard';
import type { BlogPost } from '@/types/blog';

describe('BlogPostCard', () => {
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

  it('renders without crashing', () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    expect(container).toBeInTheDocument();
  });

  it('displays post title', () => {
    const { getByText } = render(<BlogPostCard post={mockPost} />);
    expect(getByText('Test Post')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <BlogPostCard post={mockPost} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

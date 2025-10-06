import React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import SEOAnalysisPanel from './SEOAnalysisPanel';
import type { BlogPost } from '@/types/blog';

const meta: Meta<typeof SEOAnalysisPanel> = {
  title: 'Features/Blog/SEOAnalysisPanel',
  component: SEOAnalysisPanel,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    expanded: {
      control: 'boolean',
      description: 'Whether the panel is expanded',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SEOAnalysisPanel>;

const mockPost: BlogPost = {
  id: 'test-post',
  slug: 'test-slug',
  title: 'The Ultimate Guide to SEO Optimization',
  content: `
# The Ultimate Guide to SEO Optimization

## Introduction

Search Engine Optimization (SEO) is crucial for online visibility. This comprehensive guide covers everything you need to know.

## Key SEO Strategies

### 1. Keyword Research
Identify relevant keywords that your audience is searching for.

### 2. Content Quality
Create valuable, original content that answers user questions.

### 3. Technical SEO
Ensure your site loads fast and is mobile-friendly.

## Conclusion

Implementing these SEO strategies will improve your search rankings.
  `.trim(),
  excerpt: 'A comprehensive guide to SEO optimization strategies.',
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
    name: 'SEO Expert',
  },
  metadata: {
    tags: ['seo', 'optimization', 'marketing'],
    categories: ['digital-marketing'],
    readingTime: 5,
    wordCount: 500,
  },
  seo: {
    title: 'Ultimate SEO Guide 2024 | Best Practices',
    description:
      'Learn the best SEO optimization strategies for 2024. Improve your search rankings with our comprehensive guide.',
    keywords: ['seo', 'search engine optimization', 'seo guide', '2024'],
  },
};

export const Default: Story = {
  args: {
    post: mockPost,
    expanded: false,
  },
};

export const Expanded: Story = {
  args: {
    post: mockPost,
    expanded: true,
  },
};

export const MinimalSEO: Story = {
  args: {
    post: {
      ...mockPost,
      seo: undefined,
      metadata: {
        ...mockPost.metadata,
        tags: [],
        categories: [],
      },
    },
    expanded: true,
  },
};

export const PerfectScore: Story = {
  args: {
    post: {
      ...mockPost,
      title:
        'The Ultimate Comprehensive Guide to Advanced SEO Optimization Strategies for 2024',
      content: mockPost.content + '\n\n' + mockPost.content, // Double content for length
      seo: {
        title: 'Ultimate SEO Guide 2024 | Best Practices | Complete Tutorial',
        description:
          'Learn the best SEO optimization strategies for 2024. Improve your search rankings with our comprehensive guide covering technical SEO, content optimization, and link building.',
        keywords: [
          'seo',
          'search engine optimization',
          'seo guide',
          '2024',
          'technical seo',
          'content optimization',
        ],
      },
      metadata: {
        ...mockPost.metadata,
        tags: ['seo', 'optimization', 'marketing', 'technical-seo', 'content'],
        wordCount: 2000,
        readingTime: 10,
      },
    },
    expanded: true,
  },
};

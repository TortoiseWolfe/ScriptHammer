import type { Meta, StoryObj } from '@storybook/nextjs';
import BlogPostViewer from './BlogPostViewer';
import type { BlogPost } from '@/types/blog';
import type { TOCItem } from '@/types/metadata';

const mockPost: BlogPost = {
  id: 'test-post-1',
  slug: 'getting-started-with-nextjs',
  title: 'Getting Started with Next.js 15 and React 19',
  content: `
# Getting Started with Next.js 15 and React 19

## Introduction

Next.js 15 brings powerful new features and improvements that make building modern web applications easier than ever.

## Key Features

### 1. App Router
The new App Router provides a more intuitive way to build applications with better performance.

### 2. Server Components
React Server Components allow you to render components on the server for better performance.

### 3. Streaming
Stream content to the browser as it becomes available for faster page loads.

## Getting Started

Install Next.js with the following command:

\`\`\`bash
npx create-next-app@latest my-app
\`\`\`

## Conclusion

Next.js 15 is a game-changer for web development. Give it a try!
  `.trim(),
  excerpt:
    'Learn how to get started with Next.js 15 and React 19 in this comprehensive guide.',
  status: 'published',
  publishedAt: '2024-03-15T10:00:00Z',
  createdAt: '2024-03-10T08:00:00Z',
  updatedAt: '2024-03-15T10:00:00Z',
  version: 1,
  syncStatus: 'synced',
  offline: {
    isOfflineDraft: false,
  },
  author: {
    id: 'author-1',
    name: 'Jane Developer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane',
  },
  metadata: {
    tags: ['nextjs', 'react', 'web-development', 'tutorial'],
    categories: ['tutorials', 'web-development'],
    readingTime: 8,
    wordCount: 650,
    featuredImage:
      'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&h=630',
    featuredImageAlt: 'Next.js and React logos',
  },
  seo: {
    title: 'Getting Started with Next.js 15 & React 19 | Complete Guide',
    description:
      'Learn Next.js 15 and React 19 with this comprehensive tutorial covering App Router, Server Components, and more.',
    keywords: [
      'nextjs',
      'react',
      'app router',
      'server components',
      'web development',
    ],
  },
};

const mockTOC: TOCItem[] = [
  {
    id: 'introduction',
    text: 'Introduction',
    level: 2,
    children: [],
  },
  {
    id: 'key-features',
    text: 'Key Features',
    level: 2,
    children: [
      { id: '1-app-router', text: '1. App Router', level: 3, children: [] },
      {
        id: '2-server-components',
        text: '2. Server Components',
        level: 3,
        children: [],
      },
      { id: '3-streaming', text: '3. Streaming', level: 3, children: [] },
    ],
  },
  {
    id: 'getting-started',
    text: 'Getting Started',
    level: 2,
    children: [],
  },
  {
    id: 'conclusion',
    text: 'Conclusion',
    level: 2,
    children: [],
  },
];

const meta: Meta<typeof BlogPostViewer> = {
  title: 'Features/Blog/BlogPostViewer',
  component: BlogPostViewer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Full blog post viewer with table of contents, author info, and SEO features.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showAuthor: {
      control: 'boolean',
      description: 'Show author section',
    },
    showToc: {
      control: 'boolean',
      description: 'Show table of contents',
    },
    seoScore: {
      control: { type: 'range', min: 0, max: 100 },
      description: 'SEO score to display',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    post: mockPost,
    showAuthor: true,
    showToc: false,
  },
};

export const WithTableOfContents: Story = {
  args: {
    post: mockPost,
    toc: mockTOC,
    showAuthor: true,
    showToc: true,
  },
};

export const WithSEOScore: Story = {
  args: {
    post: mockPost,
    toc: mockTOC,
    showAuthor: true,
    showToc: true,
    seoScore: 85,
  },
};

export const NoAuthor: Story = {
  args: {
    post: mockPost,
    showAuthor: false,
    showToc: false,
  },
};

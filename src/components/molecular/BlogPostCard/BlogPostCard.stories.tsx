import type { Meta, StoryObj } from '@storybook/nextjs';
import BlogPostCard from './BlogPostCard';
import type { BlogPost } from '@/types/blog';

const mockPost: BlogPost = {
  id: 'post-1',
  slug: 'typescript-best-practices',
  title: 'TypeScript Best Practices for Modern Web Development',
  content: `# TypeScript Best Practices\n\nLearn essential TypeScript patterns and practices...`,
  excerpt:
    'Discover the best practices for writing clean, maintainable TypeScript code in modern web applications.',
  status: 'published',
  publishedAt: '2024-03-10T14:30:00Z',
  createdAt: '2024-03-08T10:00:00Z',
  updatedAt: '2024-03-10T14:30:00Z',
  version: 1,
  syncStatus: 'synced',
  offline: { isOfflineDraft: false },
  author: {
    id: 'author-1',
    name: 'Sarah Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  },
  metadata: {
    tags: ['typescript', 'best-practices', 'web-development'],
    categories: ['tutorials', 'programming'],
    readingTime: 6,
    wordCount: 1200,
    featuredImage:
      'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=400',
    featuredImageAlt: 'TypeScript code on a screen',
  },
  seo: {
    title: 'TypeScript Best Practices | Complete Developer Guide',
    description:
      'Master TypeScript with these essential best practices and coding patterns for modern web development.',
    keywords: [
      'typescript',
      'best practices',
      'web development',
      'coding patterns',
    ],
  },
};

const draftPost: BlogPost = {
  ...mockPost,
  id: 'post-2',
  slug: 'draft-post',
  title: 'Advanced React Patterns (Draft)',
  status: 'draft',
  publishedAt: undefined,
  metadata: {
    ...mockPost.metadata,
    tags: ['react', 'patterns', 'advanced'],
    featuredImage: undefined,
  },
};

const meta: Meta<typeof BlogPostCard> = {
  title: 'Features/Blog/BlogPostCard',
  component: BlogPostCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Blog post preview card with SEO analysis, tags, and metadata.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showSEO: {
      control: 'boolean',
      description: 'Show SEO score and analysis',
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler',
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
    showSEO: true,
  },
};

export const WithoutSEO: Story = {
  args: {
    post: mockPost,
    showSEO: false,
  },
};

export const DraftPost: Story = {
  args: {
    post: draftPost,
    showSEO: true,
  },
};

export const NoFeaturedImage: Story = {
  args: {
    post: {
      ...mockPost,
      metadata: {
        ...mockPost.metadata,
        featuredImage: undefined,
      },
    },
    showSEO: true,
  },
};

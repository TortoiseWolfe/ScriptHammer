import type { Meta, StoryObj } from '@storybook/nextjs';
import AuthorProfile from './AuthorProfile';
import type { Author } from '@/types/author';

const mockAuthor: Author = {
  id: 'author-1',
  username: 'johndoe',
  name: 'John Doe',
  email: 'john@example.com',
  bio: 'Full-stack developer passionate about web technologies, open source, and building great user experiences.',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  website: 'https://johndoe.dev',
  location: 'San Francisco, CA',
  company: 'Tech Innovations Inc.',
  socialLinks: [
    {
      platform: 'twitter',
      url: 'https://twitter.com/johndoe',
      displayOrder: 1,
    },
    { platform: 'github', url: 'https://github.com/johndoe', displayOrder: 2 },
    {
      platform: 'linkedin',
      url: 'https://linkedin.com/in/johndoe',
      displayOrder: 3,
    },
  ],
  joinedAt: '2023-01-15T00:00:00Z',
  lastActiveAt: '2024-03-20T10:30:00Z',
  postsCount: 24,
  permissions: [
    { resource: 'post', actions: ['read', 'write', 'publish'] },
    { resource: 'author', actions: ['read', 'write'] },
  ],
  preferences: {
    emailNotifications: true,
    publicProfile: true,
    showEmail: false,
    theme: 'auto',
    language: 'en',
    timezone: 'America/Los_Angeles',
  },
  hideSocial: false,
};

const meta: Meta<typeof AuthorProfile> = {
  title: 'Features/Blog/AuthorProfile',
  component: AuthorProfile,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Author profile card displaying bio, stats, and social links.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showSocial: {
      control: 'boolean',
      description: 'Show social links',
    },
    showStats: {
      control: 'boolean',
      description: 'Show post count and member since stats',
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
    author: mockAuthor,
    showSocial: true,
    showStats: true,
  },
};

export const WithoutSocial: Story = {
  args: {
    author: mockAuthor,
    showSocial: false,
    showStats: true,
  },
};

export const WithoutStats: Story = {
  args: {
    author: mockAuthor,
    showSocial: true,
    showStats: false,
  },
};

export const MinimalProfile: Story = {
  args: {
    author: {
      ...mockAuthor,
      bio: undefined,
      avatar: undefined,
      website: undefined,
      location: undefined,
      company: undefined,
      socialLinks: [],
    },
    showSocial: true,
    showStats: true,
  },
};

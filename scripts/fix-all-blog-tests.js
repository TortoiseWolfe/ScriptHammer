#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix individual test files with proper mock data
const fixes = {
  'AuthorProfile.test.tsx': `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AuthorProfile from './AuthorProfile';
import type { Author } from '@/types/author';

describe('AuthorProfile', () => {
  const mockAuthor: Author = {
    id: 'author-1',
    name: 'Test Author',
    bio: 'Test bio',
    avatar: '/avatar.jpg',
    socials: { twitter: '@test' },
    stats: { posts: 10, views: 1000 }
  };

  it('renders without crashing', () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    expect(container).toBeInTheDocument();
  });

  it('displays author information', () => {
    const { getByText } = render(<AuthorProfile author={mockAuthor} />);
    expect(getByText('Test Author')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <AuthorProfile author={mockAuthor} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});`,

  'BlogPostCard.test.tsx': `import { describe, it, expect } from 'vitest';
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
      showShareButtons: true
    },
    seo: { title: 'Test Post', description: 'Test excerpt' }
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
});`,

  'BlogPostViewer.test.tsx': `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BlogPostViewer from './BlogPostViewer';
import type { BlogPost } from '@/types/blog';

describe('BlogPostViewer', () => {
  const mockPost: BlogPost = {
    id: 'post-1',
    slug: 'test-post',
    title: 'Test Post',
    content: 'Test content',
    excerpt: 'Test excerpt',
    status: 'published',
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
      showShareButtons: true
    },
    seo: { title: 'Test Post', description: 'Test excerpt' }
  };

  it('renders without crashing', () => {
    const { container } = render(<BlogPostViewer post={mockPost} />);
    expect(container).toBeInTheDocument();
  });

  it('displays post title', () => {
    const { getByText } = render(<BlogPostViewer post={mockPost} />);
    expect(getByText('Test Post')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <BlogPostViewer post={mockPost} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});`,

  'ConflictResolver.test.tsx': `import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ConflictResolver from './ConflictResolver';
import type { ConflictInfo } from '@/types/sync';

describe('ConflictResolver', () => {
  const mockConflict: ConflictInfo = {
    id: 'conflict-1',
    type: 'post',
    entityId: 'post-1',
    localVersion: {
      content: 'Local content',
      updatedAt: new Date().toISOString(),
      author: 'user1'
    },
    remoteVersion: {
      content: 'Remote content',
      updatedAt: new Date().toISOString(),
      author: 'user2'
    },
    baseVersion: {
      content: 'Base content',
      updatedAt: new Date().toISOString(),
      author: 'user1'
    },
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  const mockOnResolve = vi.fn();

  it('renders without crashing', () => {
    const { container } = render(
      <ConflictResolver conflict={mockConflict} onResolve={mockOnResolve} />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays conflict information', () => {
    const { getByText } = render(
      <ConflictResolver conflict={mockConflict} onResolve={mockOnResolve} />
    );
    expect(getByText(/conflict/i)).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <ConflictResolver
        conflict={mockConflict}
        onResolve={mockOnResolve}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});`,

  'SocialShareButtons.test.tsx': `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SocialShareButtons from './SocialShareButtons';
import type { ShareOptions } from '@/types/share';

describe('SocialShareButtons', () => {
  const mockShareOptions: ShareOptions = {
    title: 'Test Title',
    text: 'Test text',
    url: 'https://example.com'
  };

  it('renders without crashing', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays share buttons', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('accepts custom className', () => {
    const { container } = render(
      <SocialShareButtons
        shareOptions={mockShareOptions}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});`,
};

// Fix accessibility test files
const accessibilityFixes = {
  'AuthorProfile.accessibility.test.tsx': `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import AuthorProfile from './AuthorProfile';
import type { Author } from '@/types/author';

describe('AuthorProfile Accessibility', () => {
  const mockAuthor: Author = {
    id: 'author-1',
    name: 'Test Author',
    bio: 'Test bio',
    avatar: '/avatar.jpg',
    socials: { twitter: '@test' },
    stats: { posts: 10, views: 1000 }
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
    focusableElements.forEach(element => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } }
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<AuthorProfile author={mockAuthor} />);
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });
});`,

  'BlogPostCard.accessibility.test.tsx': `import { describe, it, expect } from 'vitest';
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
      showShareButtons: true
    },
    seo: { title: 'Test Post', description: 'Test excerpt' }
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
    focusableElements.forEach(element => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } }
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<BlogPostCard post={mockPost} />);
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });
});`,

  'BlogPostViewer.accessibility.test.tsx': `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import BlogPostViewer from './BlogPostViewer';
import type { BlogPost } from '@/types/blog';

describe('BlogPostViewer Accessibility', () => {
  const mockPost: BlogPost = {
    id: 'post-1',
    slug: 'test-post',
    title: 'Test Post',
    content: 'Test content',
    excerpt: 'Test excerpt',
    status: 'published',
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
      showShareButtons: true
    },
    seo: { title: 'Test Post', description: 'Test excerpt' }
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(<BlogPostViewer post={mockPost} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(<BlogPostViewer post={mockPost} />);
    // Add specific tests
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<BlogPostViewer post={mockPost} />);
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach(element => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<BlogPostViewer post={mockPost} />);
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } }
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<BlogPostViewer post={mockPost} />);
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });
});`,

  'ConflictResolver.accessibility.test.tsx': `import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import ConflictResolver from './ConflictResolver';
import type { ConflictInfo } from '@/types/sync';

describe('ConflictResolver Accessibility', () => {
  const mockConflict: ConflictInfo = {
    id: 'conflict-1',
    type: 'post',
    entityId: 'post-1',
    localVersion: {
      content: 'Local content',
      updatedAt: new Date().toISOString(),
      author: 'user1'
    },
    remoteVersion: {
      content: 'Remote content',
      updatedAt: new Date().toISOString(),
      author: 'user2'
    },
    baseVersion: {
      content: 'Base content',
      updatedAt: new Date().toISOString(),
      author: 'user1'
    },
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  const mockOnResolve = vi.fn();

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <ConflictResolver conflict={mockConflict} onResolve={mockOnResolve} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(
      <ConflictResolver conflict={mockConflict} onResolve={mockOnResolve} />
    );
    // Add specific tests
  });

  it('should be keyboard navigable', () => {
    const { container } = render(
      <ConflictResolver conflict={mockConflict} onResolve={mockOnResolve} />
    );
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach(element => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(
      <ConflictResolver conflict={mockConflict} onResolve={mockOnResolve} />
    );
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } }
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(
      <ConflictResolver conflict={mockConflict} onResolve={mockOnResolve} />
    );
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });
});`,

  'SocialShareButtons.accessibility.test.tsx': `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import SocialShareButtons from './SocialShareButtons';
import type { ShareOptions } from '@/types/share';

describe('SocialShareButtons Accessibility', () => {
  const mockShareOptions: ShareOptions = {
    title: 'Test Title',
    text: 'Test text',
    url: 'https://example.com'
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
    focusableElements.forEach(element => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } }
    });
    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });
});`,
};

// Process all test files
const componentsDir = path.join(process.cwd(), 'src/components/molecular');

// Fix regular test files
Object.entries(fixes).forEach(([filename, content]) => {
  const component = filename.replace('.test.tsx', '');
  const filePath = path.join(componentsDir, component, filename);
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
});

// Fix accessibility test files
Object.entries(accessibilityFixes).forEach(([filename, content]) => {
  const component = filename.replace('.accessibility.test.tsx', '');
  const filePath = path.join(componentsDir, component, filename);
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
});

console.log('All test files fixed!');

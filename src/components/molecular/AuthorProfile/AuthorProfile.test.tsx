import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AuthorProfile from './AuthorProfile';
import type { Author } from '@/types/author';

describe('AuthorProfile', () => {
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
});

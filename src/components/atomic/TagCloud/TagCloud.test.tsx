import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TagCloud from './TagCloud';

// Mock TagBadge component
vi.mock('../TagBadge', () => ({
  default: ({ tag, count, size, variant, onClick, active, className }: any) => (
    <button
      data-testid={`tag-badge-${tag}`}
      data-size={size}
      data-variant={variant}
      data-active={active}
      className={className}
      onClick={() => onClick?.(tag)}
    >
      {tag} {count !== undefined && `(${count})`}
    </button>
  ),
}));

describe('TagCloud', () => {
  const mockTags = [
    { name: 'React', count: 15 },
    { name: 'TypeScript', count: 12 },
    { name: 'Next.js', count: 8 },
    { name: 'Docker', count: 5 },
    { name: 'Testing', count: 3 },
    { name: 'CSS', count: 1 },
  ];

  it('renders all tags', () => {
    render(<TagCloud tags={mockTags} />);
    expect(screen.getByTestId('tag-cloud')).toBeInTheDocument();
    mockTags.forEach((tag) => {
      expect(screen.getByTestId(`tag-badge-${tag.name}`)).toBeInTheDocument();
    });
  });

  it('shows no tags message when empty', () => {
    render(<TagCloud tags={[]} />);
    expect(screen.getByText('No tags available')).toBeInTheDocument();
  });

  it('respects maxTags limit', () => {
    render(<TagCloud tags={mockTags} maxTags={3} />);
    const badges = screen.queryAllByTestId(/^tag-badge-/);
    expect(badges).toHaveLength(3);
  });

  it('filters by minimum count', () => {
    render(<TagCloud tags={mockTags} minCount={5} />);
    expect(screen.getByTestId('tag-badge-React')).toBeInTheDocument();
    expect(screen.getByTestId('tag-badge-TypeScript')).toBeInTheDocument();
    expect(screen.getByTestId('tag-badge-Next.js')).toBeInTheDocument();
    expect(screen.getByTestId('tag-badge-Docker')).toBeInTheDocument();
    expect(screen.queryByTestId('tag-badge-Testing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tag-badge-CSS')).not.toBeInTheDocument();
  });

  it('shows post counts when showCounts is true', () => {
    render(<TagCloud tags={mockTags} showCounts={true} />);
    expect(screen.getByTestId('tag-badge-React')).toHaveTextContent(
      'React (15)'
    );
  });

  it('hides post counts when showCounts is false', () => {
    render(<TagCloud tags={mockTags} showCounts={false} />);
    expect(screen.getByTestId('tag-badge-React')).toHaveTextContent('React');
    expect(screen.getByTestId('tag-badge-React')).not.toHaveTextContent('(15)');
  });

  it('calls onTagClick when tag is clicked', () => {
    const handleClick = vi.fn();
    render(<TagCloud tags={mockTags} onTagClick={handleClick} />);
    fireEvent.click(screen.getByTestId('tag-badge-React'));
    expect(handleClick).toHaveBeenCalledWith('React');
  });

  it('applies active state to selected tags', () => {
    render(<TagCloud tags={mockTags} selectedTags={['React', 'TypeScript']} />);
    expect(screen.getByTestId('tag-badge-React')).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(screen.getByTestId('tag-badge-TypeScript')).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(screen.getByTestId('tag-badge-Next.js')).toHaveAttribute(
      'data-active',
      'false'
    );
  });

  it('calculates sizes using linear method', () => {
    render(<TagCloud tags={mockTags} sizeMethod="linear" />);
    expect(screen.getByTestId('tag-badge-React')).toHaveAttribute(
      'data-size',
      'lg'
    );
    expect(screen.getByTestId('tag-badge-TypeScript')).toHaveAttribute(
      'data-size',
      'lg'
    );
    expect(screen.getByTestId('tag-badge-CSS')).toHaveAttribute(
      'data-size',
      'sm'
    );
  });

  it('calculates sizes using logarithmic method', () => {
    render(<TagCloud tags={mockTags} sizeMethod="logarithmic" />);
    // Logarithmic scaling should compress the range
    const badges = screen.queryAllByTestId(/^tag-badge-/);
    badges.forEach((badge) => {
      expect(badge).toHaveAttribute('data-size');
    });
  });

  it('uses fixed size when sizeMethod is fixed', () => {
    render(<TagCloud tags={mockTags} sizeMethod="fixed" />);
    const badges = screen.queryAllByTestId(/^tag-badge-/);
    badges.forEach((badge) => {
      expect(badge).toHaveAttribute('data-size', 'md');
    });
  });

  it('applies custom className', () => {
    render(<TagCloud tags={mockTags} className="custom-cloud" />);
    expect(screen.getByTestId('tag-cloud')).toHaveClass('custom-cloud');
  });

  it('sorts tags alphabetically for display', () => {
    render(<TagCloud tags={mockTags} />);
    const badges = screen.queryAllByTestId(/^tag-badge-/);
    const tagNames = badges.map((badge) =>
      badge.getAttribute('data-testid')?.replace('tag-badge-', '')
    );
    const sortedNames = [...tagNames].sort();
    expect(tagNames).toEqual(sortedNames);
  });

  it('applies primary variant to selected tags', () => {
    render(<TagCloud tags={mockTags} selectedTags={['React']} />);
    expect(screen.getByTestId('tag-badge-React')).toHaveAttribute(
      'data-variant',
      'primary'
    );
    expect(screen.getByTestId('tag-badge-TypeScript')).toHaveAttribute(
      'data-variant',
      'default'
    );
  });

  it('handles single tag correctly', () => {
    render(<TagCloud tags={[{ name: 'Solo', count: 1 }]} />);
    expect(screen.getByTestId('tag-badge-Solo')).toBeInTheDocument();
  });

  it('handles tags with same count', () => {
    const sameCounts = [
      { name: 'A', count: 5 },
      { name: 'B', count: 5 },
      { name: 'C', count: 5 },
    ];
    render(<TagCloud tags={sameCounts} />);
    expect(screen.getByTestId('tag-badge-A')).toBeInTheDocument();
    expect(screen.getByTestId('tag-badge-B')).toBeInTheDocument();
    expect(screen.getByTestId('tag-badge-C')).toBeInTheDocument();
  });
});

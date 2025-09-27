import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import TagCloud from './TagCloud';

expect.extend(toHaveNoViolations);

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
      aria-label={`Tag: ${tag}`}
    >
      {tag} {count !== undefined && `(${count})`}
    </button>
  ),
}));

describe('TagCloud Accessibility', () => {
  const mockTags = [
    { name: 'React', count: 15 },
    { name: 'TypeScript', count: 12 },
    { name: 'Next.js', count: 8 },
    { name: 'Docker', count: 5 },
    { name: 'Testing', count: 3 },
  ];

  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<TagCloud tags={mockTags} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when empty', async () => {
    const { container } = render(<TagCloud tags={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with selected tags', async () => {
    const { container } = render(
      <TagCloud tags={mockTags} selectedTags={['React', 'TypeScript']} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations without counts', async () => {
    const { container } = render(
      <TagCloud tags={mockTags} showCounts={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with click handler', async () => {
    const handleClick = vi.fn();
    const { container } = render(
      <TagCloud tags={mockTags} onTagClick={handleClick} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with different size methods', async () => {
    const { container: linear } = render(
      <TagCloud tags={mockTags} sizeMethod="linear" />
    );
    const linearResults = await axe(linear);
    expect(linearResults).toHaveNoViolations();

    const { container: log } = render(
      <TagCloud tags={mockTags} sizeMethod="logarithmic" />
    );
    const logResults = await axe(log);
    expect(logResults).toHaveNoViolations();

    const { container: fixed } = render(
      <TagCloud tags={mockTags} sizeMethod="fixed" />
    );
    const fixedResults = await axe(fixed);
    expect(fixedResults).toHaveNoViolations();
  });

  it('should have appropriate navigation role', () => {
    const { getByTestId } = render(<TagCloud tags={mockTags} />);
    const cloud = getByTestId('tag-cloud');
    expect(cloud).toHaveAttribute('role', 'navigation');
    expect(cloud).toHaveAttribute('aria-label', 'Tag cloud');
  });

  it('should have no accessibility violations with filtered tags', async () => {
    const { container } = render(<TagCloud tags={mockTags} minCount={5} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with limited tags', async () => {
    const { container } = render(<TagCloud tags={mockTags} maxTags={3} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain accessibility with many tags', async () => {
    const manyTags = Array.from({ length: 30 }, (_, i) => ({
      name: `Tag${i}`,
      count: i + 1,
    }));
    const { container } = render(<TagCloud tags={manyTags} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard navigable', () => {
    const handleClick = vi.fn();
    const { getAllByRole } = render(
      <TagCloud tags={mockTags} onTagClick={handleClick} />
    );
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    // Buttons are inherently keyboard navigable
  });
});

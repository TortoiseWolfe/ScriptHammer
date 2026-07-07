import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import TagFilter from './TagFilter';

expect.extend(toHaveNoViolations);

// Mock TagBadge component
vi.mock('../TagBadge', () => ({
  default: ({ tag, count, active, onClick, variant, size }: any) => (
    <button
      data-testid={`chip-${tag}`}
      data-active={active}
      data-variant={variant}
      data-size={size}
      onClick={() => onClick?.(tag)}
      aria-label={`Tag: ${tag}`}
    >
      {tag} {count !== undefined && `(${count})`}
    </button>
  ),
}));

describe('TagFilter Accessibility', () => {
  const mockTags = [
    { name: 'React', count: 15 },
    { name: 'TypeScript', count: 12 },
    { name: 'Next.js', count: 8 },
    { name: 'Docker', count: 5 },
    { name: 'Testing', count: 3 },
  ];

  const defaultProps = {
    tags: mockTags,
    selectedTags: [],
    onChange: vi.fn(),
  };

  it('should have no accessibility violations in checkbox mode', async () => {
    const { container } = render(
      <TagFilter {...defaultProps} mode="checkbox" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in chips mode', async () => {
    const { container } = render(<TagFilter {...defaultProps} mode="chips" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with selected tags', async () => {
    const { container } = render(
      <TagFilter {...defaultProps} selectedTags={['React', 'TypeScript']} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with search enabled', async () => {
    const { container } = render(
      <TagFilter {...defaultProps} showSearch={true} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with controls enabled', async () => {
    const { container } = render(
      <TagFilter {...defaultProps} showControls={true} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations without counts', async () => {
    const { container } = render(
      <TagFilter {...defaultProps} showCounts={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when empty', async () => {
    const { container } = render(<TagFilter {...defaultProps} tags={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have appropriate ARIA labels for checkboxes', () => {
    const { getByLabelText } = render(
      <TagFilter {...defaultProps} mode="checkbox" />
    );
    expect(getByLabelText('Select React')).toBeInTheDocument();
    expect(getByLabelText('Select TypeScript')).toBeInTheDocument();
  });

  it('should have appropriate ARIA labels for controls', () => {
    const { getByLabelText } = render(
      <TagFilter {...defaultProps} showControls={true} />
    );
    expect(getByLabelText('Select all visible tags')).toBeInTheDocument();
    expect(getByLabelText('Clear all selections')).toBeInTheDocument();
  });

  it('should have appropriate ARIA label for search', () => {
    const { getByLabelText } = render(
      <TagFilter {...defaultProps} showSearch={true} />
    );
    expect(getByLabelText('Search tags')).toBeInTheDocument();
  });

  it('should have role group for tag list', () => {
    const { getByRole } = render(<TagFilter {...defaultProps} />);
    expect(getByRole('group', { name: 'Tag selection' })).toBeInTheDocument();
  });

  it('should be keyboard navigable in checkbox mode', () => {
    const { getAllByRole } = render(
      <TagFilter {...defaultProps} mode="checkbox" />
    );
    const checkboxes = getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    // Checkboxes are inherently keyboard navigable
  });

  it('should be keyboard navigable in chips mode', () => {
    const { getAllByRole } = render(
      <TagFilter {...defaultProps} mode="chips" />
    );
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    // Buttons are inherently keyboard navigable
  });

  it('should have no accessibility violations with all features enabled', async () => {
    const { container } = render(
      <TagFilter
        {...defaultProps}
        mode="checkbox"
        showSearch={true}
        showControls={true}
        showCounts={true}
        selectedTags={['React']}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain accessibility with many tags', async () => {
    const manyTags = Array.from({ length: 30 }, (_, i) => ({
      name: `Tag${i}`,
      count: i + 1,
    }));
    const { container } = render(
      <TagFilter {...defaultProps} tags={manyTags} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have disabled state accessibility', async () => {
    const { container } = render(
      <TagFilter
        {...defaultProps}
        selectedTags={mockTags.map((t) => t.name)}
        showControls={true}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TagFilter from './TagFilter';

// Mock TagBadge component
vi.mock('../TagBadge', () => ({
  default: ({ tag, count, active, onClick, variant, size }: any) => (
    <button
      data-testid={`chip-${tag}`}
      data-active={active}
      data-variant={variant}
      data-size={size}
      onClick={() => onClick?.(tag)}
    >
      {tag} {count !== undefined && `(${count})`}
    </button>
  ),
}));

describe('TagFilter', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all tags in checkbox mode', () => {
    render(<TagFilter {...defaultProps} mode="checkbox" />);
    mockTags.forEach((tag) => {
      expect(screen.getByLabelText(`Select ${tag.name}`)).toBeInTheDocument();
      expect(screen.getByText(tag.name)).toBeInTheDocument();
    });
  });

  it('renders all tags in chips mode', () => {
    render(<TagFilter {...defaultProps} mode="chips" />);
    mockTags.forEach((tag) => {
      expect(screen.getByTestId(`chip-${tag.name}`)).toBeInTheDocument();
    });
  });

  it('shows selected tags as checked', () => {
    render(
      <TagFilter
        {...defaultProps}
        selectedTags={['React', 'TypeScript']}
        mode="checkbox"
      />
    );
    expect(screen.getByLabelText('Select React')).toBeChecked();
    expect(screen.getByLabelText('Select TypeScript')).toBeChecked();
    expect(screen.getByLabelText('Select Next.js')).not.toBeChecked();
  });

  it('calls onChange when checkbox is toggled', () => {
    const onChange = vi.fn();
    render(<TagFilter {...defaultProps} onChange={onChange} mode="checkbox" />);

    fireEvent.click(screen.getByLabelText('Select React'));
    expect(onChange).toHaveBeenCalledWith(['React']);
  });

  it('removes tag from selection when unchecked', () => {
    const onChange = vi.fn();
    render(
      <TagFilter
        {...defaultProps}
        selectedTags={['React', 'TypeScript']}
        onChange={onChange}
        mode="checkbox"
      />
    );

    fireEvent.click(screen.getByLabelText('Select React'));
    expect(onChange).toHaveBeenCalledWith(['TypeScript']);
  });

  it('filters tags based on search query', () => {
    render(<TagFilter {...defaultProps} showSearch={true} />);
    const searchInput = screen.getByPlaceholderText('Search tags...');

    fireEvent.change(searchInput, { target: { value: 'script' } });

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
    expect(screen.queryByText('Docker')).not.toBeInTheDocument();
  });

  it('shows no results message when search has no matches', () => {
    render(<TagFilter {...defaultProps} showSearch={true} />);
    const searchInput = screen.getByPlaceholderText('Search tags...');

    fireEvent.change(searchInput, { target: { value: 'xyz' } });

    expect(screen.getByText('No matching tags found')).toBeInTheDocument();
  });

  it('shows empty state when no tags provided', () => {
    render(<TagFilter {...defaultProps} tags={[]} />);
    expect(screen.getByText('No tags available')).toBeInTheDocument();
  });

  it('selects all visible tags when Select All is clicked', () => {
    const onChange = vi.fn();
    render(
      <TagFilter {...defaultProps} onChange={onChange} showControls={true} />
    );

    fireEvent.click(screen.getByLabelText('Select all visible tags'));
    expect(onChange).toHaveBeenCalledWith([
      'React',
      'TypeScript',
      'Next.js',
      'Docker',
      'Testing',
    ]);
  });

  it('clears all selections when Clear All is clicked', () => {
    const onChange = vi.fn();
    render(
      <TagFilter
        {...defaultProps}
        selectedTags={['React', 'TypeScript']}
        onChange={onChange}
        showControls={true}
      />
    );

    fireEvent.click(screen.getByLabelText('Clear all selections'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows selected count', () => {
    render(
      <TagFilter
        {...defaultProps}
        selectedTags={['React', 'TypeScript']}
        showControls={true}
      />
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('shows no selection message when none selected', () => {
    render(<TagFilter {...defaultProps} showControls={true} />);
    expect(screen.getByText('No tags selected')).toBeInTheDocument();
  });

  it('displays post counts when showCounts is true', () => {
    render(<TagFilter {...defaultProps} showCounts={true} mode="checkbox" />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('hides post counts when showCounts is false', () => {
    render(<TagFilter {...defaultProps} showCounts={false} mode="checkbox" />);
    expect(screen.queryByText('15')).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('clears only filtered selections', () => {
    const onChange = vi.fn();
    render(
      <TagFilter
        {...defaultProps}
        selectedTags={['React', 'TypeScript', 'Docker']}
        onChange={onChange}
        showSearch={true}
        showControls={true}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'script' } });

    fireEvent.click(screen.getByLabelText('Clear visible selections'));
    expect(onChange).toHaveBeenCalledWith(['React', 'Docker']);
  });

  it('disables Select All when all visible are selected', () => {
    render(
      <TagFilter
        {...defaultProps}
        selectedTags={mockTags.map((t) => t.name)}
        showControls={true}
      />
    );

    expect(screen.getByLabelText('Select all visible tags')).toBeDisabled();
  });

  it('disables Clear All when none selected', () => {
    render(<TagFilter {...defaultProps} showControls={true} />);
    expect(screen.getByLabelText('Clear all selections')).toBeDisabled();
  });

  it('shows selected tags summary in chips mode', () => {
    render(
      <TagFilter
        {...defaultProps}
        selectedTags={['React', 'TypeScript']}
        mode="chips"
      />
    );

    expect(screen.getByText('Selected Tags:')).toBeInTheDocument();
    // Check for the selected tag chips in the summary
    const summary = screen.getByText('Selected Tags:').parentElement;
    expect(within(summary!).getByTestId('chip-React')).toBeInTheDocument();
    expect(within(summary!).getByTestId('chip-TypeScript')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<TagFilter {...defaultProps} className="custom-filter" />);
    expect(screen.getByTestId('tag-filter')).toHaveClass('custom-filter');
  });

  it('uses custom search placeholder', () => {
    render(
      <TagFilter
        {...defaultProps}
        showSearch={true}
        searchPlaceholder="Find a tag..."
      />
    );
    expect(screen.getByPlaceholderText('Find a tag...')).toBeInTheDocument();
  });

  it('handles tag toggle in chips mode', () => {
    const onChange = vi.fn();
    render(<TagFilter {...defaultProps} onChange={onChange} mode="chips" />);

    fireEvent.click(screen.getByTestId('chip-React'));
    expect(onChange).toHaveBeenCalledWith(['React']);
  });
});

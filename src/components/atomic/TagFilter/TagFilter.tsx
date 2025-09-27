import React, { useState, useMemo } from 'react';
import TagBadge from '../TagBadge';

export interface TagOption {
  name: string;
  count: number;
}

export interface TagFilterProps {
  /** Available tags with counts */
  tags: TagOption[];
  /** Currently selected tags */
  selectedTags: string[];
  /** Selection change handler */
  onChange: (tags: string[]) => void;
  /** Display mode */
  mode?: 'checkbox' | 'chips';
  /** Show search input */
  showSearch?: boolean;
  /** Show select all/clear buttons */
  showControls?: boolean;
  /** Show post counts */
  showCounts?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder for search input */
  searchPlaceholder?: string;
}

/**
 * TagFilter component - Multi-select tag filtering interface
 *
 * @category atomic
 */
export default function TagFilter({
  tags,
  selectedTags,
  onChange,
  mode = 'checkbox',
  showSearch = true,
  showControls = true,
  showCounts = true,
  maxHeight = '400px',
  className = '',
  searchPlaceholder = 'Search tags...',
}: TagFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  // Handle tag selection
  const handleTagToggle = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter((t) => t !== tagName));
    } else {
      onChange([...selectedTags, tagName]);
    }
  };

  // Select all filtered tags
  const handleSelectAll = () => {
    const allFilteredTagNames = filteredTags.map((t) => t.name);
    const newSelection = new Set([...selectedTags, ...allFilteredTagNames]);
    onChange(Array.from(newSelection));
  };

  // Clear all selections
  const handleClearAll = () => {
    onChange([]);
  };

  // Clear only filtered selections
  const handleClearFiltered = () => {
    const filteredNames = filteredTags.map((t) => t.name);
    onChange(selectedTags.filter((t) => !filteredNames.includes(t)));
  };

  const selectedCount = selectedTags.length;
  const filteredSelectedCount = filteredTags.filter((t) =>
    selectedTags.includes(t.name)
  ).length;

  return (
    <div className={`space-y-3 ${className}`} data-testid="tag-filter">
      {/* Search Input */}
      {showSearch && (
        <div className="form-control">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="input input-bordered input-sm w-full"
            aria-label="Search tags"
          />
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-base-content/70 text-sm">
            {selectedCount > 0
              ? `${selectedCount} selected`
              : 'No tags selected'}
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleSelectAll}
              className="btn btn-ghost btn-xs"
              disabled={filteredSelectedCount === filteredTags.length}
              aria-label="Select all visible tags"
            >
              Select All
            </button>
            {searchQuery && (
              <button
                onClick={handleClearFiltered}
                className="btn btn-ghost btn-xs"
                disabled={filteredSelectedCount === 0}
                aria-label="Clear visible selections"
              >
                Clear Visible
              </button>
            )}
            <button
              onClick={handleClearAll}
              className="btn btn-ghost btn-xs"
              disabled={selectedCount === 0}
              aria-label="Clear all selections"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Tag List */}
      <div
        className="space-y-2 overflow-y-auto pr-2"
        style={{ maxHeight }}
        role="group"
        aria-label="Tag selection"
      >
        {filteredTags.length === 0 ? (
          <div className="text-base-content/60 py-4 text-center">
            {searchQuery ? 'No matching tags found' : 'No tags available'}
          </div>
        ) : mode === 'checkbox' ? (
          // Checkbox Mode
          filteredTags.map((tag) => (
            <label
              key={tag.name}
              className="hover:bg-base-200 flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.name)}
                onChange={() => handleTagToggle(tag.name)}
                className="checkbox checkbox-sm checkbox-primary"
                aria-label={`Select ${tag.name}`}
              />
              <span className="flex-1">{tag.name}</span>
              {showCounts && (
                <span className="badge badge-ghost badge-sm">{tag.count}</span>
              )}
            </label>
          ))
        ) : (
          // Chips Mode
          <div className="flex flex-wrap gap-2">
            {filteredTags.map((tag) => (
              <TagBadge
                key={tag.name}
                tag={tag.name}
                count={showCounts ? tag.count : undefined}
                active={selectedTags.includes(tag.name)}
                onClick={handleTagToggle}
                variant={
                  selectedTags.includes(tag.name) ? 'primary' : 'default'
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected Tags Summary (for chips mode) */}
      {mode === 'chips' && selectedCount > 0 && (
        <div className="border-t pt-3">
          <div className="mb-2 text-sm font-semibold">Selected Tags:</div>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tagName) => (
              <TagBadge
                key={tagName}
                tag={tagName}
                size="sm"
                variant="primary"
                onClick={handleTagToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

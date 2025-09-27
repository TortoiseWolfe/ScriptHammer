import React from 'react';
import TagBadge from '../TagBadge';

export interface TagData {
  name: string;
  count: number;
}

export interface TagCloudProps {
  /** Array of tags with counts */
  tags: TagData[];
  /** Maximum number of tags to display */
  maxTags?: number;
  /** Minimum post count to display tag */
  minCount?: number;
  /** Tag click handler */
  onTagClick?: (tag: string) => void;
  /** Currently selected tags */
  selectedTags?: string[];
  /** Additional CSS classes */
  className?: string;
  /** Show post counts */
  showCounts?: boolean;
  /** Size calculation method */
  sizeMethod?: 'linear' | 'logarithmic' | 'fixed';
}

/**
 * TagCloud component - Display tags with frequency-based sizing
 *
 * @category atomic
 */
export default function TagCloud({
  tags,
  maxTags = 50,
  minCount = 1,
  onTagClick,
  selectedTags = [],
  className = '',
  showCounts = true,
  sizeMethod = 'linear',
}: TagCloudProps) {
  // Filter and sort tags
  const filteredTags = tags
    .filter((tag) => tag.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxTags);

  if (filteredTags.length === 0) {
    return (
      <div className={`text-base-content/60 py-4 text-center ${className}`}>
        No tags available
      </div>
    );
  }

  // Calculate size based on frequency
  const calculateSize = (count: number): 'sm' | 'md' | 'lg' => {
    if (sizeMethod === 'fixed') return 'md';

    const maxCount = Math.max(...filteredTags.map((t) => t.count));
    const minTagCount = Math.min(...filteredTags.map((t) => t.count));

    let ratio: number;
    if (sizeMethod === 'logarithmic') {
      // Logarithmic scaling for better distribution
      const logMax = Math.log(maxCount + 1);
      const logMin = Math.log(minTagCount + 1);
      const logCount = Math.log(count + 1);
      ratio = (logCount - logMin) / (logMax - logMin || 1);
    } else {
      // Linear scaling
      ratio = (count - minTagCount) / (maxCount - minTagCount || 1);
    }

    if (ratio > 0.66) return 'lg';
    if (ratio > 0.33) return 'md';
    return 'sm';
  };

  // Calculate variant based on selection state
  const getVariant = (
    tagName: string
  ): 'default' | 'primary' | 'secondary' | 'accent' => {
    if (selectedTags.includes(tagName)) return 'primary';
    return 'default';
  };

  // Sort alphabetically for display
  const displayTags = [...filteredTags].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div
      className={`flex flex-wrap justify-center gap-2 ${className}`}
      data-testid="tag-cloud"
      role="navigation"
      aria-label="Tag cloud"
    >
      {displayTags.map((tag) => (
        <TagBadge
          key={tag.name}
          tag={tag.name}
          count={showCounts ? tag.count : undefined}
          size={calculateSize(tag.count)}
          variant={getVariant(tag.name)}
          onClick={onTagClick}
          active={selectedTags.includes(tag.name)}
          className="transition-all duration-200"
        />
      ))}
    </div>
  );
}

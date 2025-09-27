import React from 'react';
import Link from 'next/link';

export interface TagBadgeProps {
  /** Tag name to display */
  tag: string;
  /** Size variant of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Style variant of the badge */
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
  /** Whether the badge is clickable */
  clickable?: boolean;
  /** Optional click handler (overrides default navigation) */
  onClick?: (tag: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show post count next to tag */
  count?: number;
  /** Active/selected state */
  active?: boolean;
}

/**
 * TagBadge component - Interactive tag badge for blog posts
 *
 * @category atomic
 */
export default function TagBadge({
  tag,
  size = 'sm',
  variant = 'default',
  clickable = true,
  onClick,
  className = '',
  count,
  active = false,
}: TagBadgeProps) {
  const sizeClasses = {
    sm: 'badge-sm text-xs',
    md: 'badge-md text-sm',
    lg: 'badge-lg text-base',
  };

  const variantClasses = {
    default: 'badge-outline',
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
  };

  const activeClasses = active
    ? 'badge-primary ring-2 ring-primary ring-offset-1'
    : '';

  const badgeClasses = `
    badge
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${activeClasses}
    ${clickable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
    ${className}
  `.trim();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(tag);
    }
  };

  const badgeContent = (
    <>
      <span>{tag}</span>
      {count !== undefined && (
        <span className="ml-1 opacity-70">({count})</span>
      )}
    </>
  );

  if (!clickable) {
    return (
      <span className={badgeClasses} data-testid="tag-badge">
        {badgeContent}
      </span>
    );
  }

  if (onClick) {
    return (
      <button
        className={badgeClasses}
        onClick={handleClick}
        aria-label={`Filter by tag: ${tag}`}
        data-testid="tag-badge"
        type="button"
      >
        {badgeContent}
      </button>
    );
  }

  return (
    <Link
      href={`/blog/tags/${encodeURIComponent(tag.toLowerCase())}`}
      className={badgeClasses}
      aria-label={`View posts tagged with ${tag}`}
      data-testid="tag-badge"
    >
      {badgeContent}
    </Link>
  );
}

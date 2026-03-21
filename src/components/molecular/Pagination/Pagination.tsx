'use client';

import React from 'react';

export interface PaginationProps {
  /** Current page (0-indexed) */
  currentPage: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Called when user changes page */
  onPageChange: (page: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Pagination component — reusable page controls for admin tables
 *
 * Renders Previous / "Page X of Y" / Next using DaisyUI join pattern.
 * Hides entirely when all items fit on one page.
 *
 * @category molecular
 */
export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
  testId,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const isFirst = currentPage === 0;
  const isLast = currentPage >= totalPages - 1;

  return (
    <nav
      aria-label={`Pagination, page ${currentPage + 1} of ${totalPages}`}
      className={`flex items-center justify-center gap-2 py-4${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      <div className="join">
        <button
          type="button"
          className="btn btn-sm join-item min-h-11 min-w-11"
          disabled={isFirst}
          aria-label="Previous page"
          onClick={() => onPageChange(currentPage - 1)}
        >
          «
        </button>
        <span
          className="btn btn-sm join-item btn-disabled min-h-11 !text-base-content"
          aria-current="page"
          data-testid={testId ? `${testId}-indicator` : undefined}
        >
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-sm join-item min-h-11 min-w-11"
          disabled={isLast}
          aria-label="Next page"
          onClick={() => onPageChange(currentPage + 1)}
        >
          »
        </button>
      </div>
    </nav>
  );
}

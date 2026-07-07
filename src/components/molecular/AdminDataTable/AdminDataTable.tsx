'use client';

import React, { useState, useMemo, type ReactNode } from 'react';

export interface AdminDataTableColumn<T> {
  /** Column key (maps to data field) */
  key: string;
  /** Column header label */
  label: string;
  /** Custom render function */
  render?: (row: T) => ReactNode;
  /** Whether column is sortable */
  sortable?: boolean;
}

export interface AdminDataTableProps<T extends Record<string, unknown>> {
  /** Column definitions */
  columns: AdminDataTableColumn<T>[];
  /** Table data */
  data: T[];
  /** Show loading state */
  isLoading?: boolean;
  /** Message when data is empty */
  emptyMessage?: string;
  /** Key field for row identity */
  keyField?: string;
  /**
   * Opt-in row expansion. When provided, each row becomes a click/Enter/Space
   * toggle. Only one row expands at a time (accordion). The returned node
   * renders in a full-width cell immediately below the trigger row.
   */
  renderExpandedRow?: (row: T) => ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * AdminDataTable component - Generic sortable data table
 *
 * @category molecular
 */
export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available',
  keyField = 'id',
  renderExpandedRow,
  className = '',
  testId,
}: AdminDataTableProps<T>) {
  const safeData = useMemo(() => data ?? ([] as T[]), [data]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Keyed by row[keyField], not index — survives sorting.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const toggleExpanded = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return safeData;

    return [...safeData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDir === 'asc' ? -1 : 1;
      if (bVal == null) return sortDir === 'asc' ? 1 : -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [safeData, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center p-8${className ? ` ${className}` : ''}`}
        data-testid={testId}
      >
        <span
          className="loading loading-spinner loading-lg"
          role="status"
          aria-label="Loading data"
        />
      </div>
    );
  }

  if (safeData.length === 0) {
    return (
      <div
        className={`bg-base-200 rounded-lg p-8 text-center${className ? ` ${className}` : ''}`}
        data-testid={testId}
      >
        {emptyMessage}
      </div>
    );
  }

  const getAriaSortValue = (
    key: string
  ): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div
      className={`overflow-x-auto${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      <table className="table">
        <thead>
          <tr>
            {renderExpandedRow && (
              <th scope="col" className="w-10">
                <span className="sr-only">Toggle details</span>
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={col.sortable ? getAriaSortValue(col.key) : undefined}
              >
                {col.sortable ? (
                  // Native <button> = tab stop + Enter/Space activation.
                  // aria-sort stays on the <th> where ARIA puts it; the
                  // arrow glyph is visual-only (aria-sort already says it).
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="hover:bg-base-300 -m-1 flex w-full items-center gap-1 rounded p-1 text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    {col.label}
                    <span aria-hidden="true" className="text-xs">
                      {sortKey === col.key
                        ? sortDir === 'asc'
                          ? '\u2191'
                          : '\u2193'
                        : '\u21c5'}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => {
            const rowKey = String(row[keyField] ?? rowIndex);
            const isExpanded = expandedKey === rowKey;

            if (!renderExpandedRow) {
              return (
                <tr key={rowKey}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            }

            // Row-click is the mouse affordance. The button is the
            // a11y-correct trigger — aria-expanded is only valid on
            // button/link roles outside treegrid (axe aria-conditional-attr).
            return (
              <React.Fragment key={rowKey}>
                <tr
                  className="hover:bg-base-200 cursor-pointer"
                  onClick={() => toggleExpanded(rowKey)}
                >
                  <td className="w-10">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Hide details' : 'Show details'}
                      className="btn btn-ghost btn-xs btn-circle min-h-11 min-w-11"
                      onClick={(e) => {
                        // Row also listens. Without this the click bubbles
                        // and toggles twice — open then immediately close.
                        e.stopPropagation();
                        toggleExpanded(rowKey);
                      }}
                    >
                      <span aria-hidden="true">
                        {isExpanded ? '\u25be' : '\u25b8'}
                      </span>
                    </button>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={columns.length + 1} className="bg-base-200">
                      {renderExpandedRow(row)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDataTable;

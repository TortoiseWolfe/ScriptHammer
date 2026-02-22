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
  className = '',
  testId,
}: AdminDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
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
  }, [data, sortKey, sortDir]);

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

  if (data.length === 0) {
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
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={col.sortable ? getAriaSortValue(col.key) : undefined}
                className={col.sortable ? 'cursor-pointer select-none' : ''}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable && sortKey === col.key
                  ? sortDir === 'asc'
                    ? ' \u2191'
                    : ' \u2193'
                  : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr key={String(row[keyField] ?? rowIndex)}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDataTable;

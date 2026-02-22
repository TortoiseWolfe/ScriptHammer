import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AdminDataTable } from './AdminDataTable';
import type { AdminDataTableColumn } from './AdminDataTable';

interface TestRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
}

const columns: AdminDataTableColumn<TestRow>[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
];

const data: TestRow[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

describe('AdminDataTable Accessibility', () => {
  it('should have no accessibility violations with data', async () => {
    const { container } = render(
      <AdminDataTable columns={columns} data={data} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when empty', async () => {
    const { container } = render(
      <AdminDataTable columns={columns} data={[]} emptyMessage="No data" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when loading', async () => {
    const { container } = render(
      <AdminDataTable columns={columns} data={[]} isLoading />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper table header scope attributes', () => {
    const { getAllByRole } = render(
      <AdminDataTable columns={columns} data={data} />
    );
    const headers = getAllByRole('columnheader');
    headers.forEach((header) => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  it('should have loading spinner with role and aria-label', () => {
    const { getByRole } = render(
      <AdminDataTable columns={columns} data={[]} isLoading />
    );
    const spinner = getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading data');
  });
});

import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

// The inert fixture above never exercised the sort-header DOM. Every
// real consumer (payments, users, audit) ships sortable: true on most
// columns, so axe needs to see that branch too.
const sortableColumns: AdminDataTableColumn<TestRow>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
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

  it('should have no violations with expandable rows, all collapsed', async () => {
    const { container } = render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={(row) => <div>Detail for {row.name}</div>}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with sortable headers, unsorted', async () => {
    // <th aria-sort="none"><button>Label</button></th> — axe's
    // aria-allowed-attr and button-name both see this.
    const { container } = render(
      <AdminDataTable columns={sortableColumns} data={data} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations after sorting (aria-sort=ascending on one th)', async () => {
    const { container, getByRole } = render(
      <AdminDataTable columns={sortableColumns} data={data} />
    );
    fireEvent.click(getByRole('button', { name: 'Name' }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with one row expanded', async () => {
    // aria-expanded on <tr> + a second <tr><td colSpan> immediately after.
    // axe's aria-allowed-attr and table-structure rules both see this.
    const { container, getByText } = render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={(row) => <div>Detail for {row.name}</div>}
      />
    );
    fireEvent.click(getByText('Alice').closest('tr')!);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminDataTable } from './AdminDataTable';
import type { AdminDataTableColumn } from './AdminDataTable';

interface TestRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  age: number;
}

const columns: AdminDataTableColumn<TestRow>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  { key: 'age', label: 'Age', sortable: true },
];

const data: TestRow[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com', age: 30 },
  { id: '2', name: 'Bob', email: 'bob@example.com', age: 25 },
  { id: '3', name: 'Charlie', email: 'charlie@example.com', age: 35 },
];

describe('AdminDataTable', () => {
  it('renders table with data', () => {
    render(<AdminDataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  it('shows empty message when data is empty', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={[]}
        emptyMessage="No users found"
      />
    );
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('shows default empty message', () => {
    render(<AdminDataTable columns={columns} data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    render(<AdminDataTable columns={columns} data={[]} isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading data')).toBeInTheDocument();
  });

  it('sorts data on header click', async () => {
    const user = userEvent.setup();
    render(<AdminDataTable columns={columns} data={data} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    // After first click: ascending sort
    const rows = screen.getAllByRole('row');
    // Row 0 is header, rows 1-3 are data
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Bob');
    expect(rows[3]).toHaveTextContent('Charlie');

    // Click again for descending
    await user.click(nameHeader);
    const rowsDesc = screen.getAllByRole('row');
    expect(rowsDesc[1]).toHaveTextContent('Charlie');
    expect(rowsDesc[2]).toHaveTextContent('Bob');
    expect(rowsDesc[3]).toHaveTextContent('Alice');
  });

  it('has proper th scope="col" headers', () => {
    render(<AdminDataTable columns={columns} data={data} />);
    const headers = screen.getAllByRole('columnheader');
    headers.forEach((header) => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  it('shows aria-sort on sorted column', async () => {
    const user = userEvent.setup();
    render(<AdminDataTable columns={columns} data={data} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    expect(nameHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('supports custom render function', () => {
    const customColumns: AdminDataTableColumn<TestRow>[] = [
      {
        key: 'name',
        label: 'Name',
        render: (row) => <strong data-testid="bold-name">{row.name}</strong>,
      },
    ];
    render(<AdminDataTable columns={customColumns} data={data} />);
    const boldNames = screen.getAllByTestId('bold-name');
    expect(boldNames).toHaveLength(3);
    expect(boldNames[0]).toHaveTextContent('Alice');
  });

  it('accepts testId', () => {
    render(
      <AdminDataTable columns={columns} data={data} testId="admin-table" />
    );
    expect(screen.getByTestId('admin-table')).toBeInTheDocument();
  });
});

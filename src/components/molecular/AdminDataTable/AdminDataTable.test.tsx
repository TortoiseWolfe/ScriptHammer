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

// Sortable headers render as buttons so they land in the tab order.
// Native <button> gives Enter/Space activation for free — no onKeyDown
// handler to maintain. aria-sort stays on the <th> (ARIA spec: it's a
// columnheader attribute, not a button attribute). This is the WAI-ARIA
// APG "Sortable Table" pattern: <th aria-sort><button>Label</button></th>.
describe('AdminDataTable sort keyboard access', () => {
  it('sortable columns render a button, non-sortable columns render plain text', () => {
    render(<AdminDataTable columns={columns} data={data} />);
    // Name + Age are sortable, Email is not.
    expect(screen.getByRole('button', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Age' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Email' })
    ).not.toBeInTheDocument();
    // Email is still a columnheader, just inert.
    expect(screen.getByText('Email').closest('th')).toHaveAttribute(
      'scope',
      'col'
    );
  });

  it('Tab reaches the sort button, Enter triggers ascending sort', async () => {
    const user = userEvent.setup();
    render(<AdminDataTable columns={columns} data={data} />);

    // Native tab order: first button encountered is the Name header.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Name' })).toHaveFocus();

    await user.keyboard('{Enter}');
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[3]).toHaveTextContent('Charlie');
    expect(
      screen.getByRole('button', { name: /^Name/ }).closest('th')
    ).toHaveAttribute('aria-sort', 'ascending');
  });

  it('Enter twice toggles to descending', async () => {
    const user = userEvent.setup();
    render(<AdminDataTable columns={columns} data={data} />);

    const btn = screen.getByRole('button', { name: 'Age' });
    btn.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Charlie'); // age 35
    expect(rows[3]).toHaveTextContent('Bob'); // age 25
    expect(btn.closest('th')).toHaveAttribute('aria-sort', 'descending');
  });

  it('Space also triggers sort', async () => {
    const user = userEvent.setup();
    render(<AdminDataTable columns={columns} data={data} />);

    const btn = screen.getByRole('button', { name: 'Age' });
    btn.focus();
    await user.keyboard(' ');

    expect(btn.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('aria-sort="none" on sortable-but-unsorted, absent on non-sortable', () => {
    // axe doesn't enforce the SHOULD-be-on-one-column guidance, and
    // VoiceOver/NVDA both read "none" usefully ("not sorted"). The
    // distinction that matters: Email has no aria-sort at all, because
    // announcing "not sorted" on a column you can't sort is a lie.
    render(<AdminDataTable columns={columns} data={data} />);

    expect(screen.getByText('Name').closest('th')).toHaveAttribute(
      'aria-sort',
      'none'
    );
    expect(screen.getByText('Age').closest('th')).toHaveAttribute(
      'aria-sort',
      'none'
    );
    expect(screen.getByText('Email').closest('th')).not.toHaveAttribute(
      'aria-sort'
    );
  });

  it('sort buttons coexist with expand buttons — tab order is headers then rows', async () => {
    // Payment panel has both: 6 sortable columns + expansion chevrons.
    // The sort buttons come first in DOM order (thead before tbody).
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={(r) => <div>{r.name}</div>}
      />
    );

    await user.tab();
    expect(screen.getByRole('button', { name: 'Name' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Age' })).toHaveFocus();
    await user.tab();
    // Next stop: first row's expand chevron.
    expect(
      screen.getByText('Alice').closest('tr')!.querySelector('button')
    ).toHaveFocus();
  });
});

// Expansion is opt-in via renderExpandedRow. When present, each data row
// gets a leading chevron-button cell. The button is the a11y-correct
// trigger (aria-expanded lives there — axe rejects it on <tr> outside
// treegrid). The whole row also responds to click for the mouse path.
describe('AdminDataTable row expansion', () => {
  const renderDetail = (row: TestRow) => (
    <div data-testid={`detail-${row.id}`}>Age is {row.age}</div>
  );

  it('no toggle column, no interactive rows when renderExpandedRow is absent', () => {
    render(<AdminDataTable columns={columns} data={data} />);
    expect(
      screen.queryByRole('button', { name: /details/i })
    ).not.toBeInTheDocument();
    // 3 columns, not 4
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });

  it('adds one toggle button per row, all collapsed initially', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );
    const toggles = screen.getAllByRole('button', { name: /details/i });
    expect(toggles).toHaveLength(3);
    toggles.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });
    // Leading header cell added to keep column alignment.
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('clicking anywhere on the row opens and closes the detail', async () => {
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );

    expect(screen.queryByTestId('detail-1')).not.toBeInTheDocument();

    const aliceRow = screen.getByText('Alice').closest('tr')!;
    await user.click(aliceRow);

    expect(screen.getByTestId('detail-1')).toBeInTheDocument();
    expect(screen.getByTestId('detail-1')).toHaveTextContent('Age is 30');
    // aria-expanded tracks on the button, not the row
    expect(aliceRow.querySelector('button')).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.click(aliceRow);
    expect(screen.queryByTestId('detail-1')).not.toBeInTheDocument();
    expect(aliceRow.querySelector('button')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('expanding a second row collapses the first (accordion)', async () => {
    // "Drill into A transaction" — singular. One detail open at a time
    // means the expanded row is the one you're reading, not one of N.
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );

    await user.click(screen.getByText('Alice').closest('tr')!);
    expect(screen.getByTestId('detail-1')).toBeInTheDocument();

    await user.click(screen.getByText('Bob').closest('tr')!);
    expect(screen.queryByTestId('detail-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-2')).toBeInTheDocument();
  });

  it('Enter on the focused toggle button expands', async () => {
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );

    const btn = screen
      .getByText('Alice')
      .closest('tr')!
      .querySelector('button')!;
    btn.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('detail-1')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(screen.queryByTestId('detail-1')).not.toBeInTheDocument();
  });

  it('Space on the focused toggle button expands', async () => {
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );

    const btn = screen.getByText('Bob').closest('tr')!.querySelector('button')!;
    btn.focus();
    await user.keyboard(' ');
    expect(screen.getByTestId('detail-2')).toBeInTheDocument();
  });

  it('detail cell spans every column including the toggle column', async () => {
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );

    await user.click(screen.getByText('Alice').closest('tr')!);
    const detailCell = screen.getByTestId('detail-1').closest('td');
    // 3 data columns + 1 toggle column
    expect(detailCell).toHaveAttribute('colspan', '4');
  });

  it('expansion follows the row through a sort', async () => {
    // expandedKey is the row's keyField value, not its index. Re-sorting
    // moves rows around; the detail stays attached to its parent row.
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );

    await user.click(screen.getByText('Charlie').closest('tr')!);
    expect(screen.getByTestId('detail-3')).toBeInTheDocument();

    // Sort by age asc → Charlie (35) ends up last. Still expanded.
    await user.click(screen.getByText('Age'));
    expect(screen.getByTestId('detail-3')).toBeInTheDocument();

    const charlieRow = screen.getByText('Charlie').closest('tr')!;
    expect(charlieRow.nextElementSibling).toContainElement(
      screen.getByTestId('detail-3')
    );
  });

  it('clicking the button directly does not double-toggle', async () => {
    // Row has onClick; button inside it also triggers the toggle. Without
    // stopPropagation the click bubbles and the net effect is open→close
    // in one gesture. The observable contract: one click = one toggle.
    const user = userEvent.setup();
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        renderExpandedRow={renderDetail}
      />
    );

    const btn = screen
      .getByText('Alice')
      .closest('tr')!
      .querySelector('button')!;
    await user.click(btn);
    expect(screen.getByTestId('detail-1')).toBeInTheDocument();
  });
});

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminDataTable } from './AdminDataTable';
import type { AdminDataTableColumn } from './AdminDataTable';

interface SampleUser extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const sampleColumns: AdminDataTableColumn<SampleUser>[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
];

const sortableColumns: AdminDataTableColumn<SampleUser>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'status', label: 'Status' },
];

const sampleData: SampleUser[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'Admin',
    status: 'Active',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'User',
    status: 'Active',
  },
  {
    id: '3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    role: 'Moderator',
    status: 'Inactive',
  },
  {
    id: '4',
    name: 'Diana Prince',
    email: 'diana@example.com',
    role: 'Admin',
    status: 'Active',
  },
  {
    id: '5',
    name: 'Eve Wilson',
    email: 'eve@example.com',
    role: 'User',
    status: 'Pending',
  },
];

const meta: Meta<typeof AdminDataTable> = {
  title: 'Components/Molecular/AdminDataTable',
  component: AdminDataTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Generic sortable data table for admin dashboard views.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
  },
};

export const Empty: Story = {
  args: {
    columns: sampleColumns,
    data: [],
    emptyMessage: 'No users found',
  },
};

export const Loading: Story = {
  args: {
    columns: sampleColumns,
    data: [],
    isLoading: true,
  },
};

export const Sortable: Story = {
  args: {
    columns: sortableColumns,
    data: sampleData,
  },
};

export const ThemeShowcase: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <AdminDataTable {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <AdminDataTable {...args} />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <AdminDataTable {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

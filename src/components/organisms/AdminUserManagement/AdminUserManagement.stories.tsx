import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminUserManagement } from './AdminUserManagement';
import type {
  AdminUserStats,
  AdminUserRow,
} from '@/services/admin/admin-user-service';

const mockStats: AdminUserStats = {
  total_users: 200,
  active_this_week: 85,
  pending_connections: 7,
  total_connections: 120,
};

// Relative to now so "2 days ago" stays accurate in Storybook.
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const mockUsers: AdminUserRow[] = [
  {
    id: 'user-1',
    username: 'alice_wonder',
    display_name: 'Alice Wonderland',
    created_at: '2025-01-15T10:00:00Z',
    welcome_message_sent: true,
    last_sign_in_at: daysAgo(2),
    activity: 'active',
  },
  {
    id: 'user-2',
    username: 'bob_builder',
    display_name: 'Bob Builder',
    created_at: '2025-03-20T14:30:00Z',
    welcome_message_sent: false,
    last_sign_in_at: daysAgo(15),
    activity: 'idle',
  },
  {
    id: 'user-3',
    username: 'carol_singer',
    display_name: 'Carol Singer',
    created_at: '2025-05-10T08:00:00Z',
    welcome_message_sent: true,
    last_sign_in_at: daysAgo(60),
    activity: 'dormant',
  },
  {
    id: 'user-4',
    username: null,
    display_name: null,
    created_at: '2025-06-01T09:00:00Z',
    welcome_message_sent: false,
    last_sign_in_at: null,
    activity: 'dormant',
  },
];

const meta: Meta<typeof AdminUserManagement> = {
  title: 'Components/Organisms/AdminUserManagement',
  component: AdminUserManagement,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Admin user management panel displaying user statistics and a sortable user listing with welcome message status.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stats: mockStats,
    users: mockUsers,
    total: 200,
    searchQuery: '',
    onSearchChange: () => {},
  },
};

export const DormantAccounts: Story = {
  name: 'Dormant accounts (the scanning question)',
  args: {
    stats: mockStats,
    users: [
      { ...mockUsers[2] },
      { ...mockUsers[3] },
      {
        id: 'user-5',
        username: 'dave_silent',
        display_name: 'Dave Silent',
        created_at: '2024-11-01T00:00:00Z',
        welcome_message_sent: true,
        last_sign_in_at: daysAgo(120),
        activity: 'dormant',
      },
    ],
    total: 3,
    searchQuery: '',
    onSearchChange: () => {},
  },
};

export const SearchFiltered: Story = {
  args: {
    stats: mockStats,
    users: [mockUsers[0]],
    total: 1,
    searchQuery: 'alice',
    onSearchChange: () => {},
  },
};

export const Loading: Story = {
  args: {
    stats: null,
    users: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    stats: {
      total_users: 0,
      active_this_week: 0,
      pending_connections: 0,
      total_connections: 0,
    },
    users: [],
  },
};

export const ThemeShowcase: Story = {
  args: {
    stats: mockStats,
    users: mockUsers,
  },
  render: (args) => (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-100 surface</p>
        <AdminUserManagement {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-200 surface</p>
        <AdminUserManagement {...args} />
      </div>
    </div>
  ),
};

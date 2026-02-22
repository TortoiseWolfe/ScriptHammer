import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminAuditTrail } from './AdminAuditTrail';
import type {
  AdminAuthStats,
  AuditLogEntry,
} from '@/services/admin/admin-audit-service';

const mockStats: AdminAuthStats = {
  logins_today: 28,
  failed_this_week: 5,
  signups_this_month: 12,
  rate_limited_users: 2,
  top_failed_logins: [],
};

const mockStatsWithAnomalies: AdminAuthStats = {
  ...mockStats,
  top_failed_logins: [
    { user_id: 'user-abc-123-def-456', attempts: 15 },
    { user_id: 'user-xyz-789-ghi-012', attempts: 8 },
  ],
};

const mockEvents: AuditLogEntry[] = [
  {
    id: 'evt-1',
    user_id: 'user-abc-123-def-456',
    event_type: 'sign_in_success',
    success: true,
    ip_address: '192.168.1.1',
    created_at: '2025-06-15T10:30:00Z',
  },
  {
    id: 'evt-2',
    user_id: 'user-xyz-789-ghi-012',
    event_type: 'sign_in_failed',
    success: false,
    ip_address: '10.0.0.1',
    created_at: '2025-06-15T09:00:00Z',
  },
  {
    id: 'evt-3',
    user_id: 'user-lmn-345-opq-678',
    event_type: 'sign_up',
    success: true,
    ip_address: '172.16.0.1',
    created_at: '2025-06-14T14:00:00Z',
  },
  {
    id: 'evt-4',
    user_id: 'user-abc-123-def-456',
    event_type: 'password_change',
    success: true,
    ip_address: '192.168.1.1',
    created_at: '2025-06-14T12:00:00Z',
  },
];

const meta: Meta<typeof AdminAuditTrail> = {
  title: 'Components/Organisms/AdminAuditTrail',
  component: AdminAuditTrail,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Admin audit trail displaying authentication statistics, event log with filtering, and anomaly detection alerts.',
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
    events: mockEvents,
    eventTypeFilter: '',
    onEventTypeChange: () => {},
  },
};

export const Loading: Story = {
  args: {
    stats: null,
    events: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    stats: {
      logins_today: 0,
      failed_this_week: 0,
      signups_this_month: 0,
      rate_limited_users: 0,
      top_failed_logins: [],
    },
    events: [],
    eventTypeFilter: '',
    onEventTypeChange: () => {},
  },
};

export const WithAnomalies: Story = {
  args: {
    stats: mockStatsWithAnomalies,
    events: mockEvents,
    eventTypeFilter: '',
    onEventTypeChange: () => {},
  },
};

export const ThemeShowcase: Story = {
  args: {
    stats: mockStatsWithAnomalies,
    events: mockEvents,
    eventTypeFilter: '',
    onEventTypeChange: () => {},
  },
  render: (args) => (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-100 surface</p>
        <AdminAuditTrail {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-200 surface</p>
        <AdminAuditTrail {...args} />
      </div>
    </div>
  ),
};

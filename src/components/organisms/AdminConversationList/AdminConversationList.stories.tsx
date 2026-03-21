import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { AdminConversationList } from './AdminConversationList';
import type { AdminConversationRow } from '@/services/admin/admin-messaging-service';

// Fixtures anchored to "now" so the relative-time column stays readable
// ("3 days ago", not "427 days ago") regardless of when Storybook is opened.
const NOW = Date.now();
const H = 60 * 60 * 1000;
const D = 24 * H;

const ROWS: AdminConversationRow[] = [
  {
    conversation_id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
    is_group: false,
    participant_count: 2,
    message_count: 847,
    last_activity: new Date(NOW - 2 * H).toISOString(),
    created_at: new Date(NOW - 90 * D).toISOString(),
  },
  {
    conversation_id: 'b2c3d4e5-f6a7-8901-bcde-f01234567890',
    is_group: true,
    participant_count: 12,
    message_count: 3201,
    last_activity: new Date(NOW - 5 * H).toISOString(),
    created_at: new Date(NOW - 60 * D).toISOString(),
  },
  {
    conversation_id: 'c3d4e5f6-a7b8-9012-cdef-012345678901',
    is_group: false,
    participant_count: 2,
    message_count: 4,
    last_activity: new Date(NOW - 3 * D).toISOString(),
    created_at: new Date(NOW - 3 * D).toISOString(),
  },
  {
    conversation_id: 'd4e5f6a7-b8c9-0123-def0-123456789012',
    is_group: true,
    participant_count: 3,
    message_count: 0,
    // 45 days > STALE_THRESHOLD_MS (30d) — this row carries the stale badge
    // in every story. Dead group, zero messages: the archetype this flag exists for.
    last_activity: new Date(NOW - 45 * D).toISOString(),
    created_at: new Date(NOW - 45 * D).toISOString(),
  },
];

const meta: Meta<typeof AdminConversationList> = {
  title: 'Components/Organisms/AdminConversationList',
  component: AdminConversationList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Per-conversation metadata drill-down for the admin messaging panel. Metadata only — conversation_id, counts, timestamps. No participant identities, no message content.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    data: ROWS,
    total: 120,
    offset: 0,
    pageSize: 50,
    onPageChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MidPage: Story = {
  args: { offset: 50 },
  parameters: {
    docs: {
      description: {
        story: 'Both Previous and Next enabled — showing 51–54 of 120.',
      },
    },
  },
};

export const LastPage: Story = {
  args: { offset: 100, total: 104 },
  parameters: {
    docs: {
      description: {
        story: 'Next disabled — offset + pageSize ≥ total.',
      },
    },
  },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const Empty: Story = {
  args: { data: [], total: 0, offset: 0 },
  parameters: {
    docs: {
      description: {
        story: 'AdminDataTable shows its empty state; count reads 0–0 of 0.',
      },
    },
  },
};

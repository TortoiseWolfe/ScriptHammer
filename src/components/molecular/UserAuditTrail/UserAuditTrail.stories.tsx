import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import UserAuditTrail from './UserAuditTrail';

/**
 * UserAuditTrail shows the signed-in user's own recent auth audit events
 * (sign-ins, password changes, verification, etc.), read RLS-scoped from
 * `auth_audit_logs`. In Storybook there is no authenticated Supabase session,
 * so the live query resolves to an empty/error state — the stories below
 * exercise the component's own loading and empty rendering. See the unit tests
 * for populated-table coverage (the data layer is mocked there).
 */
const meta: Meta<typeof UserAuditTrail> = {
  title: 'Components/Molecular/UserAuditTrail',
  component: UserAuditTrail,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "UserAuditTrail component for the molecular category — a user-facing 'recent security activity' view.",
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    limit: {
      control: 'number',
      description: 'How many recent events to show (default 25)',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const SmallLimit: Story = {
  args: {
    limit: 5,
  },
};

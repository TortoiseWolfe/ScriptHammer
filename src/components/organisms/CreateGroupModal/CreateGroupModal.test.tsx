/**
 * Unit Tests for CreateGroupModal
 * Feature 010: Group Chats
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreateGroupModal } from './CreateGroupModal';

// Mock hooks and services
vi.mock('@/hooks/useGroupMembers', () => ({
  useGroupMembers: () => ({
    searchResults: [],
    selectedMembers: [],
    isLoading: false,
    error: null,
    searchConnections: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    clearSelection: vi.fn(),
    isAtCapacity: false,
    remainingSlots: 199,
    getSelectedProfiles: () => [],
  }),
}));

vi.mock('@/services/messaging/group-service', () => ({
  groupService: {
    createGroup: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user' } },
        error: null,
      })),
    },
  }),
}));

describe('CreateGroupModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onGroupCreated: vi.fn(),
  };

  it('renders when open', () => {
    render(<CreateGroupModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('New Group')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<CreateGroupModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has accessible form labels', () => {
    render(<CreateGroupModal {...defaultProps} />);
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/add members/i)).toBeInTheDocument();
  });

  it('shows cancel and create buttons', () => {
    render(<CreateGroupModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create group/i })
    ).toBeInTheDocument();
  });

  it('disables create button when no members selected', () => {
    render(<CreateGroupModal {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /create group/i })
    ).toBeDisabled();
  });
});

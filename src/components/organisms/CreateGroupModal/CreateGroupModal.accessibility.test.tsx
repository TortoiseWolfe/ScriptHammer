/**
 * Accessibility Tests for CreateGroupModal
 * Feature 010: Group Chats
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
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

describe('CreateGroupModal Accessibility', () => {
  it('should have no axe violations when open', async () => {
    const { container } = render(
      <CreateGroupModal isOpen={true} onClose={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when closed', async () => {
    const { container } = render(
      <CreateGroupModal isOpen={false} onClose={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

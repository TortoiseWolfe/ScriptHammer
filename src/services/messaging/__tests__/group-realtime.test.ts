/**
 * The group reactions to Realtime events (#1247 B2): a departure triggers the owner-side
 * rotation check, and a rotation keeps the offline send cache on the new version.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rotateIfDepartedSinceKey, updateCachedKeyVersion } = vi.hoisted(() => ({
  rotateIfDepartedSinceKey: vi.fn(async () => false),
  updateCachedKeyVersion: vi.fn(),
}));
vi.mock('../group-key-service', () => ({
  groupKeyService: { rotateIfDepartedSinceKey },
}));
vi.mock('../message-service', () => ({ updateCachedKeyVersion }));

import { onConversationChange, onMemberChange } from '../group-realtime';

const CONV = '00000000-0000-0000-0000-00000000000c';

beforeEach(() => {
  rotateIfDepartedSinceKey.mockClear();
  updateCachedKeyVersion.mockClear();
});

describe('onMemberChange', () => {
  it('a departure triggers the rotation check for that group', () => {
    onMemberChange({
      eventType: 'UPDATE',
      new: { conversation_id: CONV, left_at: '2026-09-24T12:00:00Z' },
    });
    expect(rotateIfDepartedSinceKey).toHaveBeenCalledWith(CONV);
  });

  it.each([
    [
      'an archive toggle',
      {
        eventType: 'UPDATE',
        new: { conversation_id: CONV, left_at: null, archived: true },
      },
    ],
    [
      'a new seat',
      { eventType: 'INSERT', new: { conversation_id: CONV, left_at: null } },
    ],
    ['a deleted row (PK only)', { eventType: 'DELETE', new: {} }],
  ])('ignores %s', (_label, payload) => {
    onMemberChange(payload as never);
    expect(rotateIfDepartedSinceKey).not.toHaveBeenCalled();
  });
});

describe('onConversationChange', () => {
  it('a group row update moves the cached key version', () => {
    onConversationChange({
      eventType: 'UPDATE',
      new: { id: CONV, is_group: true, current_key_version: 4 },
    });
    expect(updateCachedKeyVersion).toHaveBeenCalledWith(CONV, 4);
  });

  it('ignores 1:1 rows and inserts', () => {
    onConversationChange({
      eventType: 'UPDATE',
      new: { id: CONV, is_group: false, current_key_version: 1 },
    });
    onConversationChange({
      eventType: 'INSERT',
      new: { id: CONV, is_group: true, current_key_version: 1 },
    });
    expect(updateCachedKeyVersion).not.toHaveBeenCalled();
  });
});

/**
 * What a group's Realtime events mean for the local device (#1247 B2).
 *
 * The conversation list subscribes to conversations and conversation_members; these two
 * functions are the reactions that matter for group keys, kept apart from the hook so they can
 * be tested without a socket.
 *
 * Under RLS, Realtime delivers `payload.old` with only the primary key, even with REPLICA
 * IDENTITY FULL, so both read the NEW row alone and rely on the reaction being idempotent.
 */
import { groupKeyService } from './group-key-service';
import { updateCachedKeyVersion } from './message-service';

interface ChangePayload {
  eventType: string;
  new?: Record<string, unknown> | null;
}

/** A group's key version moved: keep the offline send cache on it. */
export function onConversationChange(payload: ChangePayload): void {
  const row = payload.new;
  if (
    payload.eventType === 'UPDATE' &&
    row?.is_group === true &&
    typeof row.id === 'string' &&
    typeof row.current_key_version === 'number'
  ) {
    updateCachedKeyVersion(row.id, row.current_key_version);
  }
}

/**
 * A member left: if this device's user owns the group, rotate the key so the leaver cannot
 * read what comes next. rotateIfDepartedSinceKey does nothing for anyone else, and nothing if
 * a rotation already followed the departure.
 */
export function onMemberChange(payload: ChangePayload): void {
  const row = payload.new;
  if (
    payload.eventType === 'UPDATE' &&
    typeof row?.conversation_id === 'string' &&
    row.left_at
  ) {
    void groupKeyService.rotateIfDepartedSinceKey(row.conversation_id);
  }
}

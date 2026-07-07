# Research: Group Chats

**Date**: 2025-12-02 | **Branch**: `010-group-chats`

## Research Summary

All technical context items resolved. No NEEDS CLARIFICATION items identified - the existing codebase provides clear patterns to follow.

---

## Decision 1: Group Key Encryption Strategy

**Decision**: Use symmetric AES-GCM-256 group key, encrypted per-member using ECDH shared secret

**Rationale**:

- Existing 1-to-1 messaging uses ECDH + AES-GCM-256, providing proven encryption foundation
- Symmetric key approach scales linearly with members (O(n) key encryptions vs O(n²) for pairwise)
- Each member's encrypted copy of group key stored in `group_keys` table
- Decryption uses existing ECDH infrastructure: `ECDH(member_private, owner_public)` → shared secret → decrypt group key

**Alternatives Considered**:

- **Pairwise ECDH for each message**: Rejected - O(n²) encryption per message doesn't scale to 200 members
- **Signal Protocol / Double Ratchet**: Rejected - complexity overkill for this use case, no per-message forward secrecy requirement
- **Server-held group keys**: Rejected - violates E2E encryption principle

---

## Decision 2: Key Version Tracking for History Restriction

**Decision**: Track `key_version_joined` per member, `key_version` per message

**Rationale**:

- Member's `key_version_joined` records which key version they received when added
- Messages tagged with `key_version` used to encrypt them
- Decryption check: if `message.key_version < member.key_version_joined`, show placeholder
- Simple integer comparison, no complex key derivation chains

**Alternatives Considered**:

- **Re-encrypt all messages on member add**: Rejected - O(n\*m) expensive, unnecessary
- **Per-message unique keys**: Rejected - Signal-style complexity without matching security benefit
- **No history restriction**: Rejected - user requirement explicitly forbids new member access to old messages

---

## Decision 3: Database Schema Approach

**Decision**: Add junction table `conversation_members` + `group_keys` table, modify existing `conversations` and `messages` tables

**Rationale**:

- Junction table cleanly supports 1-N members vs current binary columns
- Backward compatible: existing 1-to-1 conversations continue using ECDH path
- `is_group` boolean flag on conversations determines encryption path
- Monolithic migration file pattern maintained per CLAUDE.md

**Alternatives Considered**:

- **Separate `group_conversations` table**: Rejected - duplicates schema, complicates queries
- **Keep binary columns + overflow table**: Rejected - messy hybrid approach
- **NoSQL document store**: Rejected - PostgreSQL via Supabase is established stack

---

## Decision 4: UI Component Architecture

**Decision**: Create new atomic/molecular components, modify existing organisms

**Rationale**:

- `AvatarStack` (atomic) - reusable for any multi-avatar display
- `GroupMemberList` (molecular) - composed of existing `AvatarDisplay` + list patterns
- `CreateGroupModal` (organism) - complex modal with search, selection, creation
- Modify `ChatWindow`, `ConversationListItem` to support group variant
- Follow existing 5-file component pattern via generator

**Alternatives Considered**:

- **Single monolithic GroupChat component**: Rejected - violates atomic design principles
- **Separate /groups route**: Rejected - groups are conversations, unified UX preferred
- **Third-party group chat library**: Rejected - none support E2E encryption requirement

---

## Decision 5: Key Distribution Failure Handling

**Decision**: Retry 3 times, then mark member as "pending key" status

**Rationale**:

- Clarified in /clarify session with user
- "Pending key" members visible in group but cannot decrypt new messages
- Automatic retry when member comes online (presence detection via Supabase Realtime)
- Prevents blocking entire group operation due to one offline member

**Alternatives Considered**:

- **Infinite retry**: Rejected - could queue unbounded work
- **Abort operation**: Rejected - penalizes active members for offline member
- **Exclude from group**: Rejected - too aggressive, user might just be temporarily offline

---

## Decision 6: Owner Leaving Behavior

**Decision**: Owner must transfer ownership before leaving; "Leave Group" disabled for owner

**Rationale**:

- Clarified in /clarify session with user
- Prevents orphaned groups with no management authority
- UI shows "Transfer Ownership" option in group settings for owner
- Once transferred, former owner can leave normally

**Alternatives Considered**:

- **Auto-transfer to longest member**: Rejected - user explicitly chose manual transfer
- **Delete group**: Rejected - too destructive
- **Allow ownerless groups**: Rejected - no one can remove problematic members

---

## Decision 7: Single-Member Group Persistence

**Decision**: Group persists with owner only; owner can continue adding members

**Rationale**:

- Clarified in /clarify session with user
- Minimum members at creation is 2, but can drop to 1 via departures
- Owner retains full history and can rebuild group
- No automatic deletion threshold

**Alternatives Considered**:

- **Auto-delete at 1 member**: Rejected - loses history unnecessarily
- **Convert back to DM**: Rejected - conceptual mismatch, no "other" participant

---

## Technology Best Practices Applied

### Web Crypto API for Group Keys

- Generate group key: `crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 })`
- Export for storage: `crypto.subtle.exportKey('raw', groupKey)`
- Encrypt group key for member: Use ECDH shared secret as wrapping key
- Pattern matches existing `src/lib/messaging/encryption.ts`

### Supabase Realtime for Group Events

- Subscribe to `conversation_members` changes for member join/leave
- Subscribe to `messages` for new group messages
- Pattern matches existing `useConversationRealtime` hook

### RLS Policies for Group Security

- Members can only see groups they belong to
- Only owner can delete group or remove members
- Any member can add (checked via connection status)
- Pattern matches existing RLS in migration file

---

## Unresolved Items

None - all research complete.

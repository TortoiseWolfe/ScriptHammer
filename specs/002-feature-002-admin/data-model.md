# Data Model: Feature 002 - Admin Welcome Message & Email Verification

**Date**: 2025-11-28
**Branch**: `002-feature-002-admin`

## Schema Changes

### 1. user_profiles Table Addition

```sql
-- Add welcome_message_sent tracking column
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS welcome_message_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient lookup of users needing welcome messages
CREATE INDEX IF NOT EXISTS idx_user_profiles_welcome_pending
ON user_profiles (id)
WHERE welcome_message_sent = FALSE;
```

### 2. Admin Profile Seed

```sql
-- Admin profile for system messages (fixed UUID)
INSERT INTO user_profiles (id, username, display_name, welcome_message_sent)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'scripthammer',
  'ScriptHammer',
  TRUE  -- Admin doesn't need welcome message
)
ON CONFLICT (id) DO NOTHING;
```

### 3. RLS Policy Update

```sql
-- Allow admin to create conversations with any user
CREATE POLICY "admin_create_conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid
  AND (
    participant_1_id = auth.uid() OR participant_2_id = auth.uid()
  )
);

-- Allow admin to send messages in their conversations
CREATE POLICY "admin_send_messages"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
  )
);
```

## Entity Relationships

```
┌─────────────────────┐     ┌──────────────────────┐
│   auth.users        │     │   user_profiles      │
├─────────────────────┤     ├──────────────────────┤
│ id (UUID) PK        │────▶│ id (UUID) PK/FK      │
│ email               │     │ username             │
│ email_confirmed_at  │     │ display_name         │
│ ...                 │     │ welcome_message_sent │◀─── NEW
└─────────────────────┘     └──────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────────┐
                            │ user_encryption_keys │
                            ├──────────────────────┤
                            │ id (UUID) PK         │
                            │ user_id (UUID) FK    │
                            │ public_key (JSONB)   │
                            │ encryption_salt      │
                            └──────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
          ┌─────────────────┐               ┌─────────────────┐
          │  conversations  │               │    messages     │
          ├─────────────────┤               ├─────────────────┤
          │ id (UUID) PK    │◀──────────────│ conversation_id │
          │ participant_1_id│               │ sender_id       │
          │ participant_2_id│               │ encrypted_content│
          │ last_message_at │               │ initialization_vector│
          └─────────────────┘               └─────────────────┘
```

## Data Flow

### Welcome Message Send

```
1. User signs in → initializeKeys()
2. Check user_profiles.welcome_message_sent = FALSE
3. Derive admin keys from env password
4. Create/get conversation (admin ↔ user)
5. Encrypt welcome message with user's public key
6. Insert into messages table
7. Set user_profiles.welcome_message_sent = TRUE
```

### Email Verification Check

```
1. User navigates to /messages
2. MessagingGate checks auth.users.email_confirmed_at
3. If NULL and NOT OAuth → Show verification required UI
4. If NOT NULL or OAuth → Allow access
```

## Environment Variables

| Variable                    | Type   | Purpose                           | Example                                |
| --------------------------- | ------ | --------------------------------- | -------------------------------------- |
| `TEST_USER_ADMIN_EMAIL`     | Secret | Admin login email                 | `admin@scripthammer.com`               |
| `TEST_USER_ADMIN_PASSWORD`  | Secret | Admin password for key derivation | `<secure-64-char>`                     |
| `NEXT_PUBLIC_ADMIN_USER_ID` | Public | Admin UUID for client reference   | `00000000-0000-0000-0000-000000000001` |

## Migration Strategy

1. Edit `supabase/migrations/20251006_complete_monolithic_setup.sql`
2. Add column with `IF NOT EXISTS` for idempotency
3. Add admin profile with `ON CONFLICT DO NOTHING`
4. Add RLS policies for admin operations
5. Execute via Supabase Dashboard SQL Editor

## Validation Queries

```sql
-- Verify welcome_message_sent column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name = 'welcome_message_sent';

-- Verify admin profile exists
SELECT id, username, display_name, welcome_message_sent
FROM user_profiles
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Count users pending welcome message
SELECT COUNT(*)
FROM user_profiles
WHERE welcome_message_sent = FALSE;
```

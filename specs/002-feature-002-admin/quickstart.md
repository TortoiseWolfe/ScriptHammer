# Quickstart: Feature 002 - Admin Welcome Message & Email Verification

**Branch**: `002-feature-002-admin`
**Date**: 2025-11-28

## Prerequisites

1. Docker environment running
2. Supabase project configured
3. Environment variables set in `.env`

## Setup Steps

### 1. Add Admin Environment Variables

Add to `.env`:

```bash
# Admin user for system welcome messages
TEST_USER_ADMIN_EMAIL=admin@scripthammer.com
TEST_USER_ADMIN_PASSWORD=<generate-with: openssl rand -base64 48>
NEXT_PUBLIC_ADMIN_USER_ID=00000000-0000-0000-0000-000000000001
```

### 2. Update Database Schema

Run in Supabase SQL Editor (add to monolithic migration):

```sql
-- Welcome message tracking
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS welcome_message_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Admin profile
INSERT INTO user_profiles (id, username, display_name, welcome_message_sent)
VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer', TRUE)
ON CONFLICT (id) DO NOTHING;
```

### 3. Generate MessagingGate Component

```bash
docker compose exec scripthammer pnpm run generate:component
# Name: MessagingGate
# Directory: src/components/auth
```

### 4. Run Tests

```bash
docker compose exec scripthammer pnpm test
```

## Development Workflow

### Testing Email Verification Gate

1. Create new user (don't verify email)
2. Navigate to `/messages`
3. Verify blocked state appears with resend button
4. Verify email via Supabase Dashboard
5. Refresh - should now have access

### Testing Welcome Message

1. Sign in as new user with verified email
2. Initialize encryption keys
3. Check conversations list
4. Verify ScriptHammer welcome message appears

### Testing OAuth Flow

1. Sign in with Google/GitHub
2. Navigate to `/messages`
3. Verify no email verification gate (OAuth = verified)
4. Set up messaging password
5. Verify welcome message received

## File Locations

| File                                            | Purpose                           |
| ----------------------------------------------- | --------------------------------- |
| `src/components/auth/MessagingGate/`            | Email verification gate component |
| `src/services/messaging/welcome-service.ts`     | Welcome message service           |
| `src/app/messages/page.tsx`                     | Messages page (wraps with gate)   |
| `src/components/auth/SignInForm/SignInForm.tsx` | Trigger point for welcome         |

## Debugging

### Check welcome_message_sent status

```sql
SELECT id, username, welcome_message_sent
FROM user_profiles
WHERE id = '<user-uuid>';
```

### Reset for testing

```sql
UPDATE user_profiles
SET welcome_message_sent = FALSE
WHERE id = '<user-uuid>';
```

### Check admin keys exist

```sql
SELECT user_id, public_key IS NOT NULL as has_key
FROM user_encryption_keys
WHERE user_id = '00000000-0000-0000-0000-000000000001';
```

## Environment Variable Reference

| Variable                    | Required | Description                   |
| --------------------------- | -------- | ----------------------------- |
| `TEST_USER_ADMIN_EMAIL`     | Yes      | Admin login email             |
| `TEST_USER_ADMIN_PASSWORD`  | Yes      | Admin password (min 32 chars) |
| `NEXT_PUBLIC_ADMIN_USER_ID` | Yes      | Admin UUID (fixed value)      |

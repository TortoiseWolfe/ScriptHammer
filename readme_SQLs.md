# original setup:

```sql
-- =============================================================================
-- Script 1: Backend Schema Initialization for SupaBase with Realtime Chat Messaging and Role Support
-- =============================================================================
-- Run this script before any user (including the admin) is created.
-- This script sets up:
--   • The pgcrypto extension for UUID generation.
--   • Tables: profiles (with a role column), posts, conversations, messages.
--   • Indexes for performance.
--   • Trigger functions and triggers to auto-update updated_at,
--     and a trigger to designate the very first profile as admin.
--   • A public "users" view (joining auth.users with profiles).
--   • RLS policies on all tables with RBAC (using auth.uid()).
--   • Explicit publication of the realtime tables.
-- =============================================================================

-- 1. Enable pgcrypto extension (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the profiles table (stores user details) with a role column.
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY,
    avatar text,
    "displayName" text,
    bio text,
    role text NOT NULL DEFAULT 'user',  -- 'admin', 'moderator', 'editor', or 'user'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_profiles_users FOREIGN KEY (id)
        REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 2a. Create a trigger function to set the role automatically.
--      The very first profile inserted will be set as 'admin'; all others default to 'user'
CREATE OR REPLACE FUNCTION public.set_role_if_first()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM public.profiles) = 0 THEN
      NEW.role := 'admin';
  ELSE
      IF NEW.role IS NULL THEN
         NEW.role := 'user';
      END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2b. Attach the trigger function to profiles.
DROP TRIGGER IF EXISTS set_role_if_first_trigger ON public.profiles;
CREATE TRIGGER set_role_if_first_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.set_role_if_first();

-- 3. Create the posts table (optional, for user posts)
CREATE TABLE public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_posts_user_id ON public.posts(user_id);

-- 4. Create the conversations table (chat sessions between two users)
CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1 uuid NOT NULL,
    user2 uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_conversations_user1 FOREIGN KEY (user1)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_conversations_user2 FOREIGN KEY (user2)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_different_users CHECK (user1 <> user2)
);
CREATE INDEX idx_conversations_user1 ON public.conversations(user1);
CREATE INDEX idx_conversations_user2 ON public.conversations(user2);

-- 5. Create the messages table (individual messages in a conversation)
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES public.conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);

-- 6. Create a trigger function to update the updated_at column on updates.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for profiles, posts, and messages to auto-update updated_at.
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- 7. Create the public "users" view (joins auth.users with profiles)
CREATE OR REPLACE VIEW public.users AS
SELECT
    u.id,
    u.email,
    p.avatar,
    p."displayName",
    p.bio,
    p.role,
    p.created_at,
    p.updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id;

-- 8. Enable Row Level Security (RLS) and define policies

-- For profiles: allow everyone to SELECT (to support UI display).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles
FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles
FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
FOR UPDATE WITH CHECK (auth.uid() = id);

-- For posts (if used).
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Posts select policy" ON public.posts;
CREATE POLICY "Posts select policy" ON public.posts
FOR SELECT USING (true);
DROP POLICY IF EXISTS "Posts insert policy" ON public.posts;
CREATE POLICY "Posts insert policy" ON public.posts
FOR INSERT WITH CHECK (true);

-- For conversations: only participants may view or insert.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Conversations select policy" ON public.conversations;
CREATE POLICY "Conversations select policy" ON public.conversations
FOR SELECT USING (
  auth.uid() = user1 OR auth.uid() = user2
);
DROP POLICY IF EXISTS "Conversations insert policy" ON public.conversations;
CREATE POLICY "Conversations insert policy" ON public.conversations
FOR INSERT WITH CHECK (
  auth.uid() = user1 OR auth.uid() = user2
);

-- For messages: only users who are in the conversation may SELECT, and sender must match on INSERT.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages select policy" ON public.messages;
CREATE POLICY "Messages select policy" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.user1 = auth.uid() OR c.user2 = auth.uid())
  )
);
DROP POLICY IF EXISTS "Messages insert policy" ON public.messages;
CREATE POLICY "Messages insert policy" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);

-- 9. Publish tables for realtime subscriptions.
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- =============================================================================
-- End of Script 1
-- =============================================================================

```

## testing data

```sql
-- =============================================================================
-- Script 2: Seed Sample Testers, Create Conversations with Admin, and Insert Initial Messages
-- =============================================================================
-- Run this script after the admin account is created.
-- This script does the following:
--   1. Retrieves the admin user using the specified admin email.
--   2. Ensures the admin has a profile in public.profiles.
--   3. For each sample tester (Jon Doe, Jane Doe, Test User):
--        a. Inserts the tester into auth.users if not already present.
--        b. Inserts a corresponding profile into public.profiles.
--           (Since the admin is already present, these will be marked as role 'user'.)
--        c. Checks for an existing conversation between the tester and the admin.
--           - If none exists, creates a new conversation.
--        d. Inserts an initial message from the tester to the admin.
--
-- IMPORTANT:
--   - Update the admin_email variable with your real admin's email.
--   - The password hash used corresponds to "password123" (bcrypt); adjust if needed.
-- =============================================================================

DO $$
DECLARE
    admin_email text := 'admin@yourdomain.com';  -- Replace with your real admin email
    admin_id uuid;
    tester record;
    tester_id uuid;
    conv_id uuid;
BEGIN
    -- Retrieve the admin user's ID from auth.users.
    SELECT id INTO admin_id
    FROM auth.users
    WHERE email = admin_email;
    
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin user not found with email: %', admin_email;
    END IF;
    
    -- Ensure the admin has a profile in public.profiles.
    INSERT INTO public.profiles (id, avatar, "displayName", bio, created_at, updated_at)
    VALUES (
        admin_id,
        NULL,
        (SELECT email FROM auth.users WHERE id = admin_id),
        '',
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Loop over each sample tester.
    FOR tester IN
      SELECT * FROM (VALUES
         ('jon@example.com', 'Jon Doe', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8h6zLCQ1MPv6Uo/Mz7KblIwd4ZpP4W'),
         ('jane@example.com', 'Jane Doe', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8h6zLCQ1MPv6Uo/Mz7KblIwd4ZpP4W'),
         ('testuser@example.com', 'Test User', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8h6zLCQ1MPv6Uo/Mz7KblIwd4ZpP4W')
      ) AS t(email, displayName, encrypted_password)
    LOOP
        -- Check if the tester exists in auth.users.
        SELECT id INTO tester_id
        FROM auth.users
        WHERE email = tester.email;
        
        IF tester_id IS NULL THEN
            -- Insert the tester into auth.users.
            INSERT INTO auth.users (
                id,
                aud,
                role,
                email,
                encrypted_password,
                created_at,
                updated_at
            )
            VALUES (
                gen_random_uuid(),
                'authenticated',
                'authenticated',
                tester.email,
                tester.encrypted_password,
                now(),
                now()
            )
            RETURNING id INTO tester_id;
        END IF;
        
        -- Ensure the tester has a profile in public.profiles.
        INSERT INTO public.profiles (id, avatar, "displayName", bio, created_at, updated_at)
        VALUES (
            tester_id,
            NULL,
            tester.displayName,
            '',
            now(),
            now()
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Check for an existing conversation between the admin and this tester.
        SELECT id INTO conv_id
        FROM public.conversations
        WHERE (user1 = admin_id AND user2 = tester_id)
           OR (user1 = tester_id AND user2 = admin_id)
        LIMIT 1;
        
        IF conv_id IS NULL THEN
            -- Create a new conversation between admin and tester.
            INSERT INTO public.conversations (user1, user2)
            VALUES (admin_id, tester_id)
            RETURNING id INTO conv_id;
        END IF;
        
        -- Insert an initial message from the tester to the admin.
        INSERT INTO public.messages (conversation_id, sender_id, content)
        VALUES (
            conv_id,
            tester_id,
            'Hello Admin, this is ' || tester.displayName || '!'
        );
    END LOOP;
END $$;
-- =============================================================================
-- End of Script 2
-- =============================================================================

```

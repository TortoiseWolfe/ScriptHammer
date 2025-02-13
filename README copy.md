## Script 1: Expanded Backend Schema Initialization

```sql
-- =============================================================================
-- Script 1: Backend Schema Initialization for SupaBase with Realtime Chat Messaging and Role Support
-- =============================================================================
-- Run this script before any user (including the admin) is created.
-- This script sets up:
--   • The pgcrypto extension for UUID generation.
--   • Tables: profiles (with a role column), posts, conversations, messages.
--   • Extended tables: comments, post_reactions, message_reactions,
--     friend_requests, friend_blocks, reports, groups, group_members, events,
--     event_invitations, media_attachments.
--   • Indexes for performance.
--   • Trigger functions and triggers to auto-update updated_at columns.
--     (and a trigger to designate the very first profile as admin)
--   • A public "users" view (joining auth.users with profiles).
--   • Row Level Security (RLS) policies on all tables for SELECT, INSERT, UPDATE, DELETE,
--     so users can manage (edit and delete) their own data.
--   • Publication of the realtime tables.
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
--     The very first profile inserted will be set as 'admin'; all others default to 'user'
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

-- 3. Create the posts table (for user posts)
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

---------------------------------------------------------------
-- Extended Tables
---------------------------------------------------------------

-- 6a. Comments on posts
CREATE TABLE public.comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id)
        REFERENCES public.posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);

-- 6b. Post reactions (e.g., likes, emojis)
CREATE TABLE public.post_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_post_reactions_post FOREIGN KEY (post_id)
        REFERENCES public.posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_post_reactions_user FOREIGN KEY (user_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_post_reactions_post_id ON public.post_reactions(post_id);
CREATE INDEX idx_post_reactions_user_id ON public.post_reactions(user_id);

-- 6c. Message reactions (emoji reactions in chats)
CREATE TABLE public.message_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_message_reactions_message FOREIGN KEY (message_id)
        REFERENCES public.messages (id) ON DELETE CASCADE,
    CONSTRAINT fk_message_reactions_user FOREIGN KEY (user_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON public.message_reactions(user_id);

-- 6d. Friend requests (for connecting users)
CREATE TABLE public.friend_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_friend_requests_sender FOREIGN KEY (sender_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_friend_requests_receiver FOREIGN KEY (receiver_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_friend_requests_different CHECK (sender_id <> receiver_id)
);
CREATE INDEX idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver ON public.friend_requests(receiver_id);

-- 6e. Friend blocks (to block users)
CREATE TABLE public.friend_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_friend_blocks_blocker FOREIGN KEY (blocker_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_friend_blocks_blocked FOREIGN KEY (blocked_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_friend_blocks_different CHECK (blocker_id <> blocked_id)
);
CREATE INDEX idx_friend_blocks_blocker ON public.friend_blocks(blocker_id);
CREATE INDEX idx_friend_blocks_blocked ON public.friend_blocks(blocked_id);

-- 6f. Reports (for content moderation)
CREATE TABLE public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL,
    content_type text NOT NULL,  -- 'post', 'comment', 'message', 'profile'
    content_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);

-- 6g. Groups (communities)
CREATE TABLE public.groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_groups_created_by FOREIGN KEY (created_by)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_groups_created_by ON public.groups(created_by);

-- 6h. Group members (membership within groups)
CREATE TABLE public.group_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    member_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'member',  -- 'admin', 'moderator', or 'member'
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_group_members_group FOREIGN KEY (group_id)
        REFERENCES public.groups (id) ON DELETE CASCADE,
    CONSTRAINT fk_group_members_member FOREIGN KEY (member_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_group_members_unique UNIQUE (group_id, member_id)
);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_member_id ON public.group_members(member_id);

-- 6i. Events (for scheduling and invitations)
-- Note: Added a 'cancelled_at' column for soft deletion/cancellation.
CREATE TABLE public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    event_date timestamptz NOT NULL,
    created_by uuid NOT NULL,
    cancelled_at timestamptz,  -- if non-null, event is cancelled (soft delete)
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_events_created_by FOREIGN KEY (created_by)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_events_created_by ON public.events(created_by);

-- 6j. Event invitations
CREATE TABLE public.event_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    invitee_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'declined'
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_event_invitations_event FOREIGN KEY (event_id)
        REFERENCES public.events (id) ON DELETE CASCADE,
    CONSTRAINT fk_event_invitations_invitee FOREIGN KEY (invitee_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_event_invitations_unique UNIQUE (event_id, invitee_id)
);
CREATE INDEX idx_event_invitations_event_id ON public.event_invitations(event_id);
CREATE INDEX idx_event_invitations_invitee_id ON public.event_invitations(invitee_id);

-- 6k. Media attachments (for posts and messages)
CREATE TABLE public.media_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type text NOT NULL,  -- 'post' or 'message'
    content_id uuid NOT NULL,
    media_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_attachments_content ON public.media_attachments(content_type, content_id);

---------------------------------------------------------------
-- 7. Create trigger function to update updated_at columns
---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for profiles, posts, and messages (original).
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

---------------------------------------------------------------
-- Extended: Attach triggers for additional tables.
---------------------------------------------------------------
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_friend_requests_updated_at
BEFORE UPDATE ON public.friend_requests
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

---------------------------------------------------------------
-- 8. Create the public "users" view (joins auth.users with profiles)
---------------------------------------------------------------
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

---------------------------------------------------------------
-- 9. Enable Row Level Security (RLS) and define policies
---------------------------------------------------------------

-- For profiles.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
CREATE POLICY "Profiles delete policy" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- For posts.
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Posts select policy" ON public.posts;
CREATE POLICY "Posts select policy" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Posts insert policy" ON public.posts;
CREATE POLICY "Posts insert policy" ON public.posts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Posts update policy" ON public.posts;
CREATE POLICY "Posts update policy" ON public.posts FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Posts delete policy" ON public.posts;
CREATE POLICY "Posts delete policy" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- For conversations: only participants may view, insert, update, or delete.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Conversations select policy" ON public.conversations;
CREATE POLICY "Conversations select policy" ON public.conversations
FOR SELECT USING (auth.uid() = user1 OR auth.uid() = user2);
DROP POLICY IF EXISTS "Conversations insert policy" ON public.conversations;
CREATE POLICY "Conversations insert policy" ON public.conversations
FOR INSERT WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);
DROP POLICY IF EXISTS "Conversations update policy" ON public.conversations;
CREATE POLICY "Conversations update policy" ON public.conversations
FOR UPDATE USING (auth.uid() = user1 OR auth.uid() = user2)
  WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);
DROP POLICY IF EXISTS "Conversations delete policy" ON public.conversations;
CREATE POLICY "Conversations delete policy" ON public.conversations
FOR DELETE USING (auth.uid() = user1 OR auth.uid() = user2);

-- For messages: only users in the conversation may select, and sender must match on insert, update, or delete.
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
CREATE POLICY "Messages insert policy" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Messages update policy" ON public.messages;
CREATE POLICY "Messages update policy" ON public.messages FOR UPDATE USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Messages delete policy" ON public.messages;
CREATE POLICY "Messages delete policy" ON public.messages FOR DELETE USING (auth.uid() = sender_id);

-- For comments.
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments select policy" ON public.comments;
CREATE POLICY "Comments select policy" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Comments insert policy" ON public.comments;
CREATE POLICY "Comments insert policy" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Comments update policy" ON public.comments;
CREATE POLICY "Comments update policy" ON public.comments FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Comments delete policy" ON public.comments;
CREATE POLICY "Comments delete policy" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- For post reactions.
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PostReactions select policy" ON public.post_reactions;
CREATE POLICY "PostReactions select policy" ON public.post_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "PostReactions insert policy" ON public.post_reactions;
CREATE POLICY "PostReactions insert policy" ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "PostReactions delete policy" ON public.post_reactions;
CREATE POLICY "PostReactions delete policy" ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);

-- For message reactions.
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MessageReactions select policy" ON public.message_reactions;
CREATE POLICY "MessageReactions select policy" ON public.message_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "MessageReactions insert policy" ON public.message_reactions;
CREATE POLICY "MessageReactions insert policy" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "MessageReactions delete policy" ON public.message_reactions;
CREATE POLICY "MessageReactions delete policy" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- For friend requests.
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FriendRequests select policy" ON public.friend_requests;
CREATE POLICY "FriendRequests select policy" ON public.friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "FriendRequests insert policy" ON public.friend_requests;
CREATE POLICY "FriendRequests insert policy" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "FriendRequests delete policy" ON public.friend_requests;
CREATE POLICY "FriendRequests delete policy" ON public.friend_requests FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- For friend blocks.
ALTER TABLE public.friend_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FriendBlocks select policy" ON public.friend_blocks;
CREATE POLICY "FriendBlocks select policy" ON public.friend_blocks FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
DROP POLICY IF EXISTS "FriendBlocks insert policy" ON public.friend_blocks;
CREATE POLICY "FriendBlocks insert policy" ON public.friend_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "FriendBlocks delete policy" ON public.friend_blocks;
CREATE POLICY "FriendBlocks delete policy" ON public.friend_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- For reports.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reports select policy" ON public.reports;
CREATE POLICY "Reports select policy" ON public.reports FOR SELECT USING (true);
DROP POLICY IF EXISTS "Reports insert policy" ON public.reports;
CREATE POLICY "Reports insert policy" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Reports delete policy" ON public.reports;
CREATE POLICY "Reports delete policy" ON public.reports FOR DELETE USING (auth.uid() = reporter_id);

-- For groups.
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Groups select policy" ON public.groups;
CREATE POLICY "Groups select policy" ON public.groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "Groups insert policy" ON public.groups;
CREATE POLICY "Groups insert policy" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Groups update policy" ON public.groups;
CREATE POLICY "Groups update policy" ON public.groups FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Groups delete policy" ON public.groups;
CREATE POLICY "Groups delete policy" ON public.groups FOR DELETE USING (auth.uid() = created_by);

-- For group members.
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "GroupMembers select policy" ON public.group_members;
CREATE POLICY "GroupMembers select policy" ON public.group_members FOR SELECT USING (auth.uid() = member_id);
DROP POLICY IF EXISTS "GroupMembers insert policy" ON public.group_members;
CREATE POLICY "GroupMembers insert policy" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS "GroupMembers delete policy" ON public.group_members;
CREATE POLICY "GroupMembers delete policy" ON public.group_members FOR DELETE USING (auth.uid() = member_id);

-- For events.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events select policy" ON public.events;
CREATE POLICY "Events select policy" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Events insert policy" ON public.events;
CREATE POLICY "Events insert policy" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Events update policy" ON public.events;
CREATE POLICY "Events update policy" ON public.events FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Events delete policy" ON public.events;
CREATE POLICY "Events delete policy" ON public.events FOR DELETE USING (auth.uid() = created_by);

-- For event invitations.
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "EventInvitations select policy" ON public.event_invitations;
CREATE POLICY "EventInvitations select policy" ON public.event_invitations FOR SELECT USING (auth.uid() = invitee_id);
DROP POLICY IF EXISTS "EventInvitations insert policy" ON public.event_invitations;
CREATE POLICY "EventInvitations insert policy" ON public.event_invitations FOR INSERT WITH CHECK (auth.uid() = invitee_id);
DROP POLICY IF EXISTS "EventInvitations delete policy" ON public.event_invitations;
CREATE POLICY "EventInvitations delete policy" ON public.event_invitations FOR DELETE USING (auth.uid() = invitee_id);

-- For media attachments.
ALTER TABLE public.media_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MediaAttachments select policy" ON public.media_attachments;
CREATE POLICY "MediaAttachments select policy" ON public.media_attachments FOR SELECT USING (true);
DROP POLICY IF EXISTS "MediaAttachments insert policy" ON public.media_attachments;
CREATE POLICY "MediaAttachments insert policy" ON public.media_attachments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "MediaAttachments delete policy" ON public.media_attachments;
CREATE POLICY "MediaAttachments delete policy" ON public.media_attachments FOR DELETE USING (true);

---------------------------------------------------------------
-- 10. Publish tables for realtime subscriptions.
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_attachments;

-- =============================================================================
-- End of Script 1
-- =============================================================================
```

## Script 2: Seed Sample Testers, Create Conversations with Admin, Insert Initial Messages, and Add a Sample Post

```sql
DO $$
DECLARE
    admin_email text := 'admin@yourdomain.com';  -- Replace with your real admin email
    admin_id uuid;
    tester record;
    tester_id uuid;
    conv_id uuid;
    sample_post_user_id uuid;
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
    VALUES (admin_id, NULL, admin_email, '', now(), now())
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
            INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
            VALUES (gen_random_uuid(), 'authenticated', 'authenticated', tester.email, tester.encrypted_password, now(), now())
            RETURNING id INTO tester_id;
        END IF;
        
        -- Ensure the tester has a profile in public.profiles.
        INSERT INTO public.profiles (id, avatar, "displayName", bio, created_at, updated_at)
        VALUES (tester_id, NULL, tester.displayName, '', now(), now())
        ON CONFLICT (id) DO NOTHING;
        
        -- Check for an existing conversation between admin and tester.
        SELECT id INTO conv_id
        FROM public.conversations
        WHERE (user1 = admin_id AND user2 = tester_id)
           OR (user1 = tester_id AND user2 = admin_id)
        LIMIT 1;
        
        IF conv_id IS NULL THEN
            INSERT INTO public.conversations (user1, user2)
            VALUES (admin_id, tester_id)
            RETURNING id INTO conv_id;
        END IF;
        
        -- Insert an initial message from tester to admin.
        INSERT INTO public.messages (conversation_id, sender_id, content)
        VALUES (conv_id, tester_id, 'Hello Admin, this is ' || tester.displayName || '!');
        
        -- Seed a friend request from tester to admin.
        INSERT INTO public.friend_requests (sender_id, receiver_id, status, created_at, updated_at)
        VALUES (tester_id, admin_id, 'pending', now(), now())
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Insert a sample post from the test user.
    SELECT id INTO sample_post_user_id FROM auth.users WHERE email = 'testuser@example.com';
    IF sample_post_user_id IS NULL THEN
        RAISE EXCEPTION 'Test user not found';
    END IF;
    
    INSERT INTO public.profiles (id, avatar, "displayName", bio, created_at, updated_at)
    VALUES (sample_post_user_id, NULL, 'Test User', '', now(), now())
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.posts (user_id, content)
    VALUES (
        sample_post_user_id,
        $POST$
Hey there! Meet **ScriptHammer**—a handy bash script that sets up a complete Expo app with everything you need right out of the box.

### What It Does
- **Loads Your Environment:** It starts by checking your `.env` file for essential keys like your app name, Supabase URL & anon key, and Google Maps API key.
- **Creates an Expo App:** Automatically runs `npx create-expo-app` (with TypeScript) and cleans up unneeded files.
- **Installs Dependencies:** It adds libraries for state management (Zustand), styling (Tailwind, NativeWind), authentication, maps, forms, and even realtime messaging with Supabase.
- **Sets Up Project Structure:** Creates folders and starter files for authentication, routing, theming (light/dark mode), and features like posts and chats.
- **Local CLI & Configs:** Checks and installs the local Expo CLI, and sets up configs for Metro, Babel, and Tailwind.
- **Why You'll Love It:** Saves time, uses a modern tech stack, is ready to roll, and is easily customizable.
Get started by setting up your `.env` file, run the script, and let ScriptHammer do the heavy lifting. Happy coding!
$POST$
    );
END $$;
```

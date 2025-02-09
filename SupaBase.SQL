-- =============================================
-- Comprehensive Social Network Schema for Supabase
-- Author: TurtleWolfe@ScriptHammer.com
-- Created: 2025-02-09
-- Description: Creates tables, functions, triggers, policies, and indexes
-- for a social network backend with Supabase Auth integration.
-- =============================================

-- ------------------------------------------------
-- 1. Enable Required Extensions
-- ------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------
-- 2. Create Enumerated Types
-- ------------------------------------------------
CREATE TYPE role_type AS ENUM ('user', 'moderator', 'admin');

-- ------------------------------------------------
-- 3. Create Core Tables and Enable RLS
-- ------------------------------------------------

-- 3.1 Users Table (Profiles)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role role_type NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3.2 Posts Table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 3.3 Comments Table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 3.4 Likes Table
CREATE TABLE public.likes (
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 3.5 Followers Table
CREATE TABLE public.followers (
  follower_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id)
);
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- 3.6 Messages Table
CREATE TABLE public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3.7 Notifications Table
CREATE TABLE public.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- e.g. 'like', 'comment', 'follow', 'message'
  actor_id UUID NULL REFERENCES public.users (id) ON DELETE CASCADE,
  post_id UUID NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  comment_id UUID NULL REFERENCES public.comments (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------
-- 4. Authentication & Role-Based Access Trigger
-- ------------------------------------------------
-- This trigger auto-creates a user profile when a new auth user is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INT;
BEGIN
  -- Count existing users in the public.users table
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  -- Insert a new profile with appropriate role and default display name (using email)
  INSERT INTO public.users (id, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,  -- default display name as email; adjust if full name available
    CASE 
      WHEN user_count = 0 THEN 'admin'
      ELSE 'user'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (Supabase Auth table) to call the above function on new user sign-ups
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- ------------------------------------------------
-- Example policies for users table:
CREATE POLICY "Users can view profiles" ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can edit own profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can create profile" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = id );

-- Posts policies:
CREATE POLICY "Any user can read posts" ON public.posts
  FOR SELECT
  TO authenticated
  USING ( true );

CREATE POLICY "Post owner can modify" ON public.posts
  FOR UPDATE
  USING ( auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','moderator')
  ))
  WITH CHECK ( auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','moderator')
  ));

CREATE POLICY "Post owner can delete" ON public.posts
  FOR DELETE
  USING ( auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','moderator')
  ));

CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = user_id );

-- Comments policies:
CREATE POLICY "Any user can read comments" ON public.comments
  FOR SELECT
  TO authenticated
  USING ( true );

CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Comment owner can modify" ON public.comments
  FOR UPDATE
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Comment owner can delete" ON public.comments
  FOR DELETE
  USING ( auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()
  ));

-- Likes policies:
CREATE POLICY "Any user can read likes" ON public.likes
  FOR SELECT
  TO authenticated
  USING ( true );

CREATE POLICY "Users can like posts" ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can unlike posts" ON public.likes
  FOR DELETE
  TO authenticated
  USING ( auth.uid() = user_id );

-- Followers policies:
CREATE POLICY "Any user can view follows" ON public.followers
  FOR SELECT
  TO authenticated
  USING ( true );

CREATE POLICY "Users follow others" ON public.followers
  FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = follower_id );

CREATE POLICY "Users unfollow" ON public.followers
  FOR DELETE
  TO authenticated
  USING ( auth.uid() = follower_id OR auth.uid() = followee_id );

-- Messages policies:
CREATE POLICY "Only parties can read message" ON public.messages
  FOR SELECT
  TO authenticated
  USING ( auth.uid() = sender_id OR auth.uid() = recipient_id );

CREATE POLICY "Users send messages" ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = sender_id AND auth.uid() <> recipient_id );

CREATE POLICY "Users delete own messages" ON public.messages
  FOR DELETE
  TO authenticated
  USING ( auth.uid() = sender_id OR auth.uid() = recipient_id );

-- Notifications policies:
CREATE POLICY "Target user can read notification" ON public.notifications
  FOR SELECT
  TO authenticated
  USING ( auth.uid() = user_id );

CREATE POLICY "Users manage own notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE
  TO authenticated
  USING ( auth.uid() = user_id );

-- ------------------------------------------------
-- 6. Audit Logging & Timestamp Update Functions and Triggers
-- ------------------------------------------------

-- 6.1 Audit Log Table
CREATE TABLE public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT,
  action TEXT,            -- 'INSERT', 'UPDATE', or 'DELETE'
  record_id TEXT,         -- primary key of the affected record
  user_id UUID,           -- user who performed the action
  changed_data JSONB,     -- row data as JSON
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.2 Audit Log Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, action, record_id, user_id, changed_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE 
      WHEN TG_OP = 'DELETE' THEN (OLD.id)::text
      ELSE (NEW.id)::text
    END,
    auth.uid(),
    CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to key tables (e.g., posts and comments)
CREATE TRIGGER audit_posts
AFTER INSERT OR UPDATE OR DELETE ON public.posts
FOR EACH ROW EXECUTE PROCEDURE public.log_audit();

CREATE TRIGGER audit_comments
AFTER INSERT OR UPDATE OR DELETE ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.log_audit();

-- 6.3 Timestamp Update Function
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach update timestamp triggers to tables with updated_at columns
CREATE TRIGGER set_users_updated
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();

CREATE TRIGGER set_posts_updated
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();

CREATE TRIGGER set_comments_updated
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();

-- ------------------------------------------------
-- 7. Indexes for Performance Optimization
-- ------------------------------------------------
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);

CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);

CREATE INDEX idx_likes_post_id ON public.likes(post_id);

CREATE INDEX idx_followers_followee_id ON public.followers(followee_id);

CREATE INDEX idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- ------------------------------------------------
-- 8. Storage Buckets (Reference)
-- ------------------------------------------------
-- Note: Supabase Storage buckets (e.g., 'avatars' and 'post_media') are typically created
-- via the Supabase Dashboard or API. The following policies can be applied to storage.objects.
--
-- Example storage RLS policies:
--
-- Allow authenticated users to read files in the avatars and post_media buckets:
-- CREATE POLICY "Read avatars" ON storage.objects
-- FOR SELECT
-- TO authenticated
-- USING ( bucket_id = 'avatars' );
--
-- CREATE POLICY "Read post media" ON storage.objects
-- FOR SELECT
-- TO authenticated
-- USING ( bucket_id = 'post_media' );
--
-- Allow users to insert files into their own folder (assuming the folder name matches their UID):
-- CREATE POLICY "Upload own avatar" ON storage.objects
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'avatars'
--   AND (storage.foldername(name))[1] = (auth.uid()::text)
-- );
--
-- (Additional policies for UPDATE and DELETE can be defined similarly.)

-- =============================================
-- End of Script
-- =============================================

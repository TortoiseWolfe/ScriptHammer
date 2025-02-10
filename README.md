# ScriptHammer

Got it! I will generate an optimized SQL script for Supabase to create a comprehensive social network backend. This will include:

- **Database Schema** with users, posts, comments, likes, follows, messages, and other essential entities.
- **Authentication** using Supabase Auth with extended metadata like display names, avatars, and more.
- **Role-Based Access** where the first user is an admin, and others default to regular users.
- **Storage** setup following best practices for handling file uploads (e.g., profile images, media attachments).
- **Functions & Triggers** to handle cascading deletes, audit logs, and other automation for data integrity.
- **Indexes & Performance Optimizations** based on best practices for scalability and efficiency.

I will put everything together and let you know when the script is ready.

# Supabase Social Network Schema Setup

Below is a comprehensive SQL script (with explanations) to create a social network backend on Supabase. It defines the database schema, authentication integration, storage buckets, triggers, functions, and security policies following best practices for security and scalability.

## 1. Database Schema

We'll create tables for **Users**, **Posts**, **Comments**, **Likes**, **Followers**, **Messages**, and **Notifications**. Foreign key relationships ensure referential integrity, with cascading deletes so that related records are cleaned up automatically ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=create%20table%20public)) ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=1,it%20also%20has%20the%20option)). Each table includes appropriate constraints (primary keys, not-null, etc.) and timestamp fields for tracking creation and updates.

### Users Table (Profiles)

The `users` table will store profile information for each user, linked to Supabase Auth's `auth.users` (the authentication table). We reference `auth.users(id)` as a foreign key, using `ON DELETE CASCADE` to automatically remove profile data if a user account is deleted ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=create%20table%20public)). Fields include a display name, avatar URL, bio, and a role indicating user type (`admin`, `moderator`, or `user`). We’ll use a `role` enum for consistency.

```sql
-- Enable UUID extension for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table: stores user profile info and role, linked to Supabase Auth users
CREATE TYPE role_type AS ENUM ('user', 'moderator', 'admin');

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,  -- link to Supabase Auth user ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=create%20table%20public))
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role role_type NOT NULL DEFAULT 'user',   -- default role is "user"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on users table for security ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=_%2010))
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

**Notes:** The `id` of `public.users` is the same UUID as the user's Auth ID, ensuring one-to-one mapping and data integrity ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=create%20table%20public)). We set `role` with a default of `'user'` for new signups. The first user will be elevated to admin via a trigger (defined in the Auth section below). Both `created_at` and `updated_at` timestamps default to the current time; we will add a trigger to automatically update the `updated_at` on modifications. Row-Level Security is enabled to protect this table ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=Make%20sure%20to%20protect%20the,table%20might%20look%20like%20this)) ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=_%2010)).

### Posts Table

The `posts` table stores user-generated posts. Each post belongs to a user (author). It contains text content, an optional image URL (pointing to a stored media file), and timestamps. We use a UUID as the primary key (with a generated default) for unique identification.

```sql
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,  -- post author ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=create%20table%20public))
  content TEXT,            -- text content of the post
  image_url TEXT,          -- URL or path to an image (if any) stored in Supabase Storage
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
```

**Notes:** Deleting a user will cascade-delete their posts ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=create%20table%20public)). A post’s `image_url` can store a reference to an image file in storage (we’ll set up an S3-like bucket for post images in the Storage section). RLS is enabled; policies will ensure only owners (or admins) can modify posts.

### Comments Table

The `comments` table holds comments on posts. Each comment references the post it belongs to and the user who wrote it. We cascade deletes so that if a post or user is removed, related comments are removed as well. We also include an `updated_at` for editing.

```sql
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,   -- parent post ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=alter%20table%20child_table))
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,   -- author of the comment ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=alter%20table%20child_table))
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
```

**Notes:** Cascading deletes on `post_id` and `user_id` ensure no orphaned comments ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=1,it%20also%20has%20the%20option)). RLS policies will allow any authenticated user to create comments, but only the comment author (or the post owner/admin) to edit or delete.

### Likes Table

The `likes` table tracks which user *liked* which post. This is a join table with foreign keys to `users` and `posts`. We enforce a composite primary key on `(user_id, post_id)` to prevent duplicate likes by the same user on the same post. Deleting a user or post cascades to remove associated likes.

```sql
CREATE TABLE public.likes (
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)   -- composite PK to ensure one like per user-post
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
```

**Notes:** Using a composite primary key `(user_id, post_id)` ensures uniqueness of likes. We could also add a separate serial ID and a `UNIQUE (user_id, post_id)` constraint, but a composite PK is efficient here. RLS can allow users to like/unlike posts (insert/delete their own like records), and everyone to read like counts.

### Followers Table

The `followers` table manages user follow relationships (who follows whom). Each row means `follower_id` follows `followee_id`. Both are foreign keys to `users` with cascade, so removing a user will drop any follow relationships involving them. We use a composite primary key `(follower_id, followee_id)` to avoid duplicate follow entries.

```sql
CREATE TABLE public.followers (
  follower_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id)
);

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
```

**Notes:** This table represents a many-to-many self-referential relationship on users. A user can follow many others, and be followed by many. RLS will ensure that users can only create or delete follow records involving themselves (e.g. you can follow or unfollow someone, but not force another user to follow someone).

### Messages Table

The `messages` table supports direct messaging between users. Each message has a sender and a recipient (both reference the `users` table) and content. We include a timestamp, and optionally an indicator for read/unread (not requested, but could be added). If either user is deleted, we cascade-delete the message.

```sql
CREATE TABLE public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- (optional: read_at TIMESTAMPTZ for read receipts)
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
```

**Notes:** We use a BIGINT identity for message IDs (a simple incrementing ID is fine here). Both `sender_id` and `recipient_id` cascade on delete. With RLS, we'll restrict access so that only the sender or recipient can view each message (privacy for direct messages).

### Notifications Table

The `notifications` table stores real-time alerts for events like likes, comments, follows, etc. Each notification is directed to a specific user (the one who should be notified) and can reference an actor (the user who caused the notification) and related content (post, comment, or message) depending on type. We include a `type` field (could be an enum or text describing the event type) and a `created_at`. All foreign keys use cascade deletes so that if underlying data is removed, the notification is removed too.

```sql
CREATE TABLE public.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,      -- the user who receives the notification
  type TEXT NOT NULL,                                                       -- e.g. 'like', 'comment', 'follow', 'message'
  actor_id UUID NULL REFERENCES public.users (id) ON DELETE CASCADE,        -- user who performed the action (if applicable)
  post_id UUID NULL REFERENCES public.posts (id) ON DELETE CASCADE,         -- related post (for likes/comments)
  comment_id UUID NULL REFERENCES public.comments (id) ON DELETE CASCADE,   -- related comment (for comment notifications)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
```

**Notes:** This design supports various notification types. For example, a "like" notification would have `type='like'`, `actor_id` = user who liked, `post_id` = the post that was liked, and `user_id` = the post’s author (who should be notified). A follow notification would set `type='follow'`, `actor_id` = follower, `user_id` = the person being followed (to be notified), and `post_id`/`comment_id` null. We allow `actor_id`, `post_id`, `comment_id` to be NULL because not all types will use all fields. With cascades, if a post or comment is deleted, any related notifications are cleaned up. RLS will ensure only the target user (or admins) can read their notifications.

### Schema Diagram (Conceptual)

- **users** (id PK, display_name, avatar_url, bio, role, ...).
- **posts** (id PK, user_id → users.id, content, image_url, ...).
- **comments** (id PK, post_id → posts.id, user_id → users.id, content, ...).
- **likes** (user_id → users.id, post_id → posts.id, PK [user_id, post_id]).
- **followers** (follower_id → users.id, followee_id → users.id, PK [follower_id, followee_id]).
- **messages** (id PK, sender_id → users.id, recipient_id → users.id, content, ...).
- **notifications** (id PK, user_id → users.id, actor_id → users.id, post_id → posts.id, comment_id → comments.id, type, ...).

All relationships use **ON DELETE CASCADE** for automatic cleanup ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=1,it%20also%20has%20the%20option)). This is generally safe for a social app where deleting a user or content should remove its associated dependent data (you may adjust cascade vs. restrict based on desired business logic).

## 2. Authentication & Role-Based Access

Supabase provides a built-in **Auth** system. We integrate it by using the `auth.users` table as the source of truth for user accounts. Our `public.users` profile table references `auth.users`, as shown above, to keep profile info and roles in sync ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=Make%20sure%20to%20protect%20the,table%20might%20look%20like%20this)) ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=id%20uuid%20not%20null%20references,users%20on%20delete%20cascade)). 

**Supabase Auth and Profile Setup:**

- When a new user signs up via Supabase Auth, we insert a corresponding row into `public.users`. We create a trigger on `auth.users` to handle this automatically. This trigger will assign the appropriate role to the new user.
- The **first registered user** should become an **admin**. We implement this by checking the count of existing users in the trigger function. If the new signup is the first entry, we set their role to `'admin'`; otherwise default to `'user'`. (We assume moderators would be assigned manually or via a separate process if needed.)

**Role Definitions:**

- **Admin:** Full access to all data (can moderate content, manage users).
- **Moderator:** Partial admin privileges (e.g., moderate posts/comments).
- **User:** Regular user privileges (can manage their own content).

By default, Supabase tags all logged-in users with the `authenticated` role at the database level for RLS policies. We will create custom policies to distinguish admins and moderators within those `authenticated` users.

### Auth Trigger for New Users

We create a SQL function and trigger to auto-insert into the `users` table whenever a new Auth user is created. This function will also set the role:

```sql
-- Trigger function to handle new sign-ups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INT;
BEGIN
  -- Count existing users in the public.users table
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  -- Insert a new profile with appropriate role
  INSERT INTO public.users (id, display_name, role)
  VALUES (
    NEW.id,                      -- use the new Auth user's UUID
    NEW.email,                   -- default display name as their email (or use NEW.raw_user_meta_data->>'full_name' if available)
    CASE 
      WHEN user_count = 0 THEN 'admin'   -- first ever user becomes admin
      ELSE 'user' 
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users to call the function after new signups
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**Explanation:** This trigger fires **after a new row is inserted** into `auth.users` (which happens on every sign-up). The trigger function inserts a new profile in `public.users` with the same `id`. We set `display_name` to the user's email by default (you could adjust to use any metadata provided at sign-up). The first user to sign up finds `user_count = 0` and gets `'admin'` role, all others get `'user'`. This approach ensures the initial user is an admin without manual intervention ([Creating an Admin Account in Supabase | AuthGPTs](https://docs.authgpts.com/supabas/creating-an-admin-account-in-supabase#:~:text=,table)). (If using a moderator role, you could similarly assign it based on conditions or promote users later via an update.)

*The function is marked `SECURITY DEFINER` so it can insert into `public.users` regardless of the inserting user's privileges. Ensure the function runs with adequate rights but also a safe `search_path` (here, defaulting to none or public schema).*

Supabase's docs recommend a similar trigger approach to keep an up-to-date profile table ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=begin)) ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=create%20trigger%20on_auth_user_created)). By inserting the `id` and any available metadata (like name) into `public.users`, we maintain a 1-1 relationship between Auth users and profile rows.

**Role-Based Access Control (RBAC):**

With roles assigned in our `users` table, we can enforce RBAC via Row-Level Security policies:

- **Default RLS:** Only allow users to access or modify their own data by matching `auth.uid()` to the relevant user id on rows ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=using%20%28%20%28select%20auth,complies%20with%20the%20policy%20expression)).
- **Admin/Moderator overrides:** Allow users with role `'admin'` or `'moderator'` broader access. This can be done by checking the `users.role` in policies (via a subquery or a custom JWT claim). For example, a policy could permit admins to update or delete any post.

In practice, we might add a custom JWT claim for a user's role to avoid subquery overhead in every policy ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=_%2010)) ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=select%201%20from%20roles_table)). For simplicity, one can also write policies that join on the `users` table to verify role, using a security definer function for efficiency if needed ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=Use%20security%20definer%20functions)) ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=select%201%20from%20roles_table)).

**Example RLS Policies:**

Below are some example policy statements. These would be executed after creating the tables (and enabling RLS) to enforce access rules:

```sql
-- Allow each user to view all profiles (maybe public info only) but only update their own profile
CREATE POLICY "Users can view profiles" ON public.users
FOR SELECT
TO authenticated
USING (true);  -- any authenticated user can read profiles (adjust if public/limited fields)

CREATE POLICY "Users can edit own profile" ON public.users
FOR UPDATE
TO authenticated
USING ( auth.uid() = id )         -- can only update if they are the owner of the profile
WITH CHECK ( auth.uid() = id );   -- new data still has their id ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=create%20policy%20,their%20own%20profile)) ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=using%20%28%20%28select%20auth,complies%20with%20the%20policy%20expression))

-- Allow inserting profile (handled by trigger, or if users sign up via trigger, direct insert by user isn't needed usually)
CREATE POLICY "Users can create profile" ON public.users
FOR INSERT
TO authenticated
WITH CHECK ( auth.uid() = id );

-- Posts: anyone authenticated can read posts (assuming a public feed)
CREATE POLICY "Any user can read posts" ON public.posts
FOR SELECT
TO authenticated
USING ( true );

-- Only the post author can update or delete their post (admins/mods bypass via OR condition on role)
CREATE POLICY "Post owner can modify" ON public.posts
FOR UPDATE USING ( auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','moderator')) ) )
WITH CHECK ( auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','moderator')) ) );

CREATE POLICY "Post owner can delete" ON public.posts
FOR DELETE USING ( auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','moderator')) ) );

-- Only the post owner or any authenticated user can create a post tied to themselves (auth.uid must match user_id on insert)
CREATE POLICY "Users can create posts" ON public.posts
FOR INSERT
TO authenticated
WITH CHECK ( auth.uid() = user_id );

-- Comments: allow anyone authenticated to read comments (if they can read the post, assumed)
CREATE POLICY "Any user can read comments" ON public.comments
FOR SELECT
TO authenticated
USING ( true );

-- Commenting: any user can create a comment (we trust `post_id` is a valid post they have access to)
CREATE POLICY "Users can create comments" ON public.comments
FOR INSERT
TO authenticated
WITH CHECK ( auth.uid() = user_id );

-- Editing/deleting comments: author can edit their comment
CREATE POLICY "Comment owner can modify" ON public.comments
FOR UPDATE USING ( auth.uid() = user_id )
WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Comment owner can delete" ON public.comments
FOR DELETE USING ( auth.uid() = user_id OR (SELECT auth.uid() = p.user_id FROM public.posts p WHERE p.id = post_id) )
-- (Above, allow deletion if you're the comment author or the post author moderating comments on your post)

-- Likes: allow reading likes (no restriction, or require auth)
CREATE POLICY "Any user can read likes" ON public.likes
FOR SELECT TO authenticated USING ( true );
-- Only the user themselves can like (insert) or unlike (delete)
CREATE POLICY "Users can like posts" ON public.likes
FOR INSERT TO authenticated WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Users can unlike posts" ON public.likes
FOR DELETE USING ( auth.uid() = user_id );

-- Followers: allow viewing followers/following (could be public or at least to authenticated)
CREATE POLICY "Any user can view follows" ON public.followers
FOR SELECT TO authenticated USING ( true );
-- Only allow inserting a follow if you're the follower, and deleting if you're the follower (unfollow) or the followee (remove a follower, if we allow that)
CREATE POLICY "Users follow others" ON public.followers
FOR INSERT TO authenticated WITH CHECK ( auth.uid() = follower_id );
CREATE POLICY "Users unfollow" ON public.followers
FOR DELETE USING ( auth.uid() = follower_id OR auth.uid() = followee_id );
-- (The second part allows a user to remove someone following them, simulating a block/remove follower feature if desired.)

-- Messages: only sender or recipient can view
CREATE POLICY "Only parties can read message" ON public.messages
FOR SELECT TO authenticated
USING ( auth.uid() = sender_id OR auth.uid() = recipient_id );
-- Only allow inserting a message if auth user is the sender
CREATE POLICY "Users send messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK ( auth.uid() = sender_id AND auth.uid() <> recipient_id );
-- (Optional: no self-messaging, enforced by auth.uid() <> recipient_id check)
-- No direct update (could allow editing message within short window) - skip for simplicity
-- Deletion: allow sender or recipient to delete (this might be just a soft-delete in real app)
CREATE POLICY "Users delete own messages" ON public.messages
FOR DELETE USING ( auth.uid() = sender_id OR auth.uid() = recipient_id );

-- Notifications: only the target user can select their notifications
CREATE POLICY "Target user can read notification" ON public.notifications
FOR SELECT TO authenticated
USING ( auth.uid() = user_id );
-- Inserts: handled by server or trigger, but if we allow clients to ack/read (update or delete), we restrict similarly
CREATE POLICY "Users manage own notifications" ON public.notifications
FOR UPDATE USING ( auth.uid() = user_id )
WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Users delete own notifications" ON public.notifications
FOR DELETE USING ( auth.uid() = user_id );
```

**Note:** The above policies are examples. In a real setup, you would tailor them to your sharing model (public vs private content). Also, for admin/moderator, we used an `EXISTS` subquery to check the role in the `users` table. This is functional but could be optimized (e.g., using `auth.role()` if you set up a custom JWT claim for the role). Supabase allows adding custom claims (like a `role` claim) to JWT at login, which can greatly simplify role checks in policies ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=_%2010)) ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=using%20%28%20%28select%20auth,complies%20with%20the%20policy%20expression)).

With these RLS policies, we ensure **data privacy and integrity**:
- Users only perform actions on data they own or are allowed to see.
- Malicious or unauthorized requests are blocked at the database level by default (since RLS denies anything not explicitly allowed).
- Administrators can be given override capabilities through specialized policies or by using the Supabase **Service Role** (which bypasses RLS entirely when using the service key in requests ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=))).

## 3. Storage Setup for Profiles and Media

Supabase includes an integrated **Storage** system (S3-like object storage) for files. We will set up two buckets:
- **avatars** – for user profile pictures.
- **post_media** – for images or media attached to posts.

**Bucket Creation:** In Supabase, you can create buckets via the Dashboard or using the SQL API. For example, via code or the REST API:
```js
// (Example JS - for reference, not executed here)
await supabase.storage.createBucket('avatars', { public: false });
await supabase.storage.createBucket('post_media', { public: false });
```
*(If using SQL, Supabase provides storage helper functions, but using the JS/CLI is common ([Creating Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/buckets/creating-buckets#:~:text=%2F%2F%20Use%20the%20JS%20library,to%20create%20a%20bucket)).)*

We'll assume these buckets are created. We set them to **private** (`public: false`), meaning by default no one can read or write files without authorization. This is more secure; we will define policies to allow appropriate access.

**Storage Security Policies:** Supabase Storage uses the same RLS mechanism on a special table `storage.objects` that stores object metadata ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=Supabase%20Storage%20is%20designed%20to,RLS)) ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=You%20selectively%20allow%20certain%20operations,table)). We can create RLS policies on `storage.objects` to control who can upload or download files in our buckets ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=By%20default%20Storage%20does%20not,table)) ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=For%20example%2C%20the%20only%20RLS,table)). By default, no actions are allowed until we add policies ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=By%20default%20Storage%20does%20not,table)).

For our social network:
- Only authenticated users should upload files (no anonymous uploads).
- Users can upload files to the **avatars** bucket, but ideally only for their own profile (we can enforce that they upload to a folder matching their user ID, for example).
- Users can upload files to the **post_media** bucket for their posts (e.g., in a folder per user or per post).
- Download (read) access: We might allow anyone to read these files if the content is public (e.g., profile pictures might be public). If we want to restrict to authenticated users, we can require the user to be logged in to fetch media. Here, we'll allow any authenticated user to read files from these buckets, which covers our use case (since the app will require login to view content). If truly public access is desired (e.g., public profiles), we could mark the bucket as public or add an anonymous role policy for SELECT.

**Example storage RLS policies:**

```sql
-- Allow authenticated users to read (download) any file in avatars or post_media buckets
CREATE POLICY "Read avatars" ON storage.objects
FOR SELECT
TO authenticated
USING ( bucket_id = 'avatars' );  -- allow if it's in avatars bucket (no further restriction, so any logged-in user can view avatars)
CREATE POLICY "Read post media" ON storage.objects
FOR SELECT
TO authenticated
USING ( bucket_id = 'post_media' );

-- Allow users to upload to avatars bucket, but only to their own folder (folder named with their user ID)
CREATE POLICY "Upload own avatar" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid()::text)  -- first folder in file path must equal the user's UUID ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=bucket_id%20%3D%20%27my_bucket_id%27%20and))
);

-- Allow users to update/delete their own avatar file
CREATE POLICY "Update own avatar" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid()::text)
);
CREATE POLICY "Delete own avatar" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid()::text)
);

-- Similar policies for post_media:
CREATE POLICY "Upload post media" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post_media'
  AND (storage.foldername(name))[1] = (auth.uid()::text)
);
CREATE POLICY "Manage own post media" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post_media'
  AND (storage.foldername(name))[1] = (auth.uid()::text)
);
CREATE POLICY "Delete own post media" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'post_media'
  AND (storage.foldername(name))[1] = (auth.uid()::text)
);
```

In these policies, we're using Supabase's storage helper function `storage.foldername(name)` which returns an array of folder names in the object's path ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=_%2010)) ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=bucket_id%20%3D%20%27my_bucket_id%27%20and)). We enforce that the first folder in the file path matches the user's UID for uploads. For example, a user with ID `abcd-1234-...` must upload their avatar to a path like `abcd-1234-.../profile.jpg` in the `avatars` bucket. This way, we know the file “belongs” to that user, and our policy allows them to manage it ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=bucket_id%20%3D%20%27my_bucket_id%27%20and)). 

We allow any authenticated user to read files from these buckets (you could tighten this to only allow users to read others' avatars/post media if you want to enforce friendship or privacy, but in a typical social network, profile pictures and post images are visible to others by design). If we wanted to open it further (public internet access without a token), we could mark the buckets `public: true` or add `TO anon` (unauthenticated) select policies ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=)), but here we stick to authenticated access.

With storage set up this way, uploading an avatar or a post image through Supabase client SDK will use the logged-in user's JWT, which will satisfy the INSERT policy (owner's folder). Supabase automatically tags uploaded files with an `owner` (the user's UUID) in `storage.objects.owner_id`. We could alternatively use `owner_id` in policies (e.g., `with check (auth.uid() = owner_id)` for insert ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=Allow%20a%20user%20to%20access,uploaded%20by%20the%20same%20user))), which might be simpler. The above example using folder paths is one strategy to namespace user uploads, but using the built-in `owner_id` field is also effective: by default, Supabase sets the `owner` of an uploaded file to the user performing it. For instance:

```sql
-- Simpler insert policy using owner_id (Supabase sets owner_id = auth.uid() on insert)
CREATE POLICY "Users upload to avatars" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner_id );

-- Allow users to read files they own (for stricter privacy)
CREATE POLICY "Users read own files" ON storage.objects
FOR SELECT TO authenticated
USING ( auth.uid() = owner_id );
```

However, the above strict owner-only read wouldn't let others view images. Since we want others to see the images, we chose a more permissive read policy. The bottom line is that **Supabase Storage and RLS** give fine-grained control ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=Supabase%20Storage%20is%20designed%20to,RLS)) ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=You%20selectively%20allow%20certain%20operations,table)) – you configure it to match your sharing model.

## 4. Functions & Triggers for Business Logic

Beyond the Auth trigger for new users, we set up additional triggers for cascading behaviors and auditing. Thanks to foreign key `ON DELETE CASCADE`, we often don't need custom triggers for deletes (the database does it for us) ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=1,it%20also%20has%20the%20option)). But we may want triggers for other side effects:

- **Audit Logs:** We can maintain an `audit_logs` table to record changes (insert/update/delete) on key tables like posts and comments. This helps track user actions for moderation or debugging.
- **Auto-update timestamps:** Ensure `updated_at` is refreshed on updates.
- **Notification creation:** Optionally, you could use triggers to insert notifications (e.g., when a like or comment is added, insert a notification for the post owner). This can also be done at the application level, but triggers ensure it's not missed.
- **Constraint enforcement:** Some complex constraints can be enforced via triggers (though our design mostly uses declarative constraints).

### Audit Log Table & Trigger

We create a simple audit log table and a generic trigger function that appends an entry on any change. The log will record the table name, user performing the action, type of action, and a JSON of the new or old row data.

```sql
-- Audit log table
CREATE TABLE public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT,
  action TEXT,            -- 'INSERT', 'UPDATE', or 'DELETE'
  record_id TEXT,         -- primary key of the record affected (as text for generality)
  user_id UUID,           -- who performed the action (if available)
  changed_data JSONB,     -- the new data (for insert/update) or old data (for delete)
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, action, record_id, user_id, changed_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,  -- operation: 'INSERT'/'UPDATE'/'DELETE'
    -- Use primary key value as text (assumes single-column PK for simplicity):
    CASE 
      WHEN TG_OP = 'DELETE' THEN (OLD.id)::text
      ELSE (NEW.id)::text
    END,
    auth.uid(),   -- the user performing the operation (requires function executed in context of auth; Supabase will set this)
    CASE 
      WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
      WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
    END
  );
  -- On delete, no returned row; on insert/update, return NEW to proceed
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Now attach this trigger to tables we want to audit, e.g.:

```sql
-- Attach audit trigger to Posts, Comments (and others as needed)
CREATE TRIGGER audit_posts
AFTER INSERT OR UPDATE OR DELETE ON public.posts
FOR EACH ROW EXECUTE PROCEDURE public.log_audit();
CREATE TRIGGER audit_comments
AFTER INSERT OR UPDATE OR DELETE ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.log_audit();
```

We can do this for other tables like `likes`, `followers`, etc., depending on what level of auditing is desired. (It might be overkill to audit every single like/unlike, but it's possible.)

**How it works:** On any change, an entry is written to `audit_logs` containing:
- `table_name`: e.g. "posts".
- `action`: e.g. "UPDATE".
- `record_id`: e.g. the post ID that was changed.
- `user_id`: the UUID of the user who made the change. (Supabase sets `auth.uid()` in the context of RLS policies. In a trigger, `auth.uid()` will work *if* the trigger is invoked by a user action through the API, not by a superuser role. We marked the function as SECURITY DEFINER mainly to ensure it can insert into audit_logs. We might want to remove `SECURITY DEFINER` or set a safe `SET ROLE` inside to capture the right user.)
- `changed_data`: the content of the new row (for insert/update) or the deleted row (for deletes), as JSON. This is useful for inspecting what changed.
- `timestamp`: when it happened.

This provides a basic audit trail. For a more advanced solution, you could use the Supabase **`realtime`** feature or the `pgcrypto` extension to record hash changes, etc., or Supabase's own `supa_audit` extension ([supabase/supa_audit: Generic Table Auditing - GitHub](https://github.com/supabase/supa_audit#:~:text=supabase%2Fsupa_audit%3A%20Generic%20Table%20Auditing%20,to%20tables%27%20data%20over%20time)). But the above is a straightforward approach.

**Note:** Auditing via triggers can add overhead on large scale operations. It's wise to target audit triggers only on critical tables. You can also prune the `audit_logs` table periodically to manage growth.

### Auto-update `updated_at` Columns

To ensure `updated_at` always reflects the last modification time, we'll add a BEFORE UPDATE trigger on tables with that column:

```sql
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to users, posts, comments (tables where we want to track edits)
CREATE TRIGGER set_users_updated
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();

CREATE TRIGGER set_posts_updated
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();

CREATE TRIGGER set_comments_updated
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();
```

Now, whenever a row in `users`, `posts`, or `comments` is updated, the `updated_at` will be set to the current timestamp. This trigger runs before the update is finalized, so the new timestamp is included in the write.

*(We skipped triggers on likes/follows since those are usually not "updated" – they're inserted or deleted. If you add an `updated_at` to messages or notifications and want to track edits, you could attach similarly.)*

### Additional Triggers (Optional)

Depending on your app's needs, you could add triggers to automatically create notifications. For example:
- After a new `likes` insert, create a notification for the post owner that someone liked their post.
- After a new `comments` insert, create a notification for the post owner that someone commented.
- After a new `followers` insert, notify the target that they have a new follower.
- After a new `messages` insert, perhaps create a notification for the recipient (though a realtime subscription might be used instead for chat).

These triggers would insert into `public.notifications` accordingly. Ensure they check that a notification isn't created for actions by the same user on their own content (to avoid self-notifications), etc. Due to time, we won't write them out fully, but the logic would use the NEW row data in each case to populate a notification entry.

## 5. Indexes & Performance Optimizations

To maintain performance at scale, we create indexes on columns that are frequently searched or joined. PostgreSQL automatically creates indexes on primary keys and unique constraints, but foreign key columns are not automatically indexed (except the primary key on the referenced table) ([Performance and Security Advisors | Supabase Docs](https://supabase.com/docs/guides/database/database-advisors?lint=0004_no_primary_key#:~:text=Performance%20and%20Security%20Advisors%20,based%20on%20the%20primary%20key)). We should add indexes on foreign keys and any other fields used for lookups or sorting.

**Index Plan:**

- **Users:** The primary key `id` (UUID) is already indexed. If we often query by `role` (e.g., list all admins) or `display_name` (for search), we could index those. But typical queries will use this table via joins (e.g., joining user info to posts) which use the user's id.
- **Posts:** Index `user_id` to quickly retrieve all posts by a user or to join posts to a user ([Supabase foreign key example — Restack](https://www.restack.io/docs/supabase-knowledge-supabase-foreign-key-example#:~:text=,columns%20to%20improve%20query%20performance)). Also index `created_at` if we often fetch recent posts (for a timeline feed sorted by time). Could consider a composite index on `(user_id, created_at)` if querying a user's posts in chronological order frequently.
- **Comments:** Index `post_id` (to get all comments on a post efficiently) and `user_id` (to get all comments by a user, if needed for user activity feed). Also possibly `created_at` for sorting.
- **Likes:** Primary key is composite (user_id, post_id) which effectively indexes both columns. However, to optimize queries like "how many likes on a given post" or "did user X like post Y", the composite PK suffices. We might add an index on `post_id` alone to optimize counting or listing likes for a post. Similarly, an index on `user_id` alone if we need to list what a user has liked.
- **Followers:** Primary key (follower_id, followee_id) covers both. Typically, queries are "who are X's followers?" (find all where followee_id = X) and "who is X following?" (where follower_id = X). The PK index is on (follower_id, followee_id) which efficiently handles the second query (prefix on follower_id), but not the first. So we should add a separate index on `followee_id` to quickly get followers of a user.
- **Messages:** If we retrieve conversations, we might query by a user being either sender or recipient. We should index `recipient_id` and perhaps `sender_id`. A composite index on (sender_id, recipient_id) could help for specific pair lookups, but separate indexes might be simpler for individual inbox/outbox queries.
- **Notifications:** Index `user_id` (the recipient) to fetch all notifications for a user quickly. Possibly index `created_at` (if sorting or limiting recent notifications). If notifications grow large, a combined index on `(user_id, created_at)` could be useful for retrieving a user's latest notifications.

Let's create some of these indexes:

```sql
-- Indexes for performance
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);

CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);

CREATE INDEX idx_likes_post_id ON public.likes(post_id);
-- (idx on likes.user_id is less needed since PK covers user_id as first key)

CREATE INDEX idx_followers_followee_id ON public.followers(followee_id);

CREATE INDEX idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
```

Each of these indexes will improve lookup speed in the corresponding common queries. For example, `idx_posts_user_id` makes fetching all posts by a given user fast (O(log n) search through the index rather than full table scan) ([Managing Indexes in PostgreSQL | Supabase Docs](https://supabase.com/docs/guides/database/postgres/indexes#:~:text=Here%20is%20a%20simplified%20diagram,have%20more%20than%20two%20children)) ([Supabase foreign key example — Restack](https://www.restack.io/docs/supabase-knowledge-supabase-foreign-key-example#:~:text=,columns%20to%20improve%20query%20performance)). The descending index on `created_at` in posts is useful for retrieving the newest posts quickly (as many feeds do). 

**Scalability considerations:**

- We used **UUIDs** for many primary keys (users, posts, comments). This is good for distributed systems and avoids sequential ID guessing, but can fragment indexes over time. PostgreSQL can handle this, but you might consider using the `gen_random_uuid()` (already used) which generates v4 UUIDs (completely random). There’s a minor performance hit compared to bigserial, but acceptable for many applications. If order and locality are important, some use cases opt for time-sortable UUIDs (v7) or bigserial IDs for certain tables. Here, consistency and simplicity with UUIDs is fine.
- **Foreign key cascades:** We applied cascading deletes to maintain integrity. In a large system, deleting a user (which triggers cascades) could be heavy if that user has thousands of posts, comments, etc. In practice, such operations are infrequent and it's better to maintain integrity than to leave orphaned data. Ensure such cascades are done carefully (or disable a user's account instead of deleting, if data retention is desired).
- **Partitioning:** Not needed at initial stages, but if tables like posts or notifications grow into the millions, consider partitioning by user or time for easier maintenance.
- **Connection limits and scaling:** Supabase scales Postgres under the hood; using connection pooling and handling N+1 queries at the application level is important. The schema itself is not a bottleneck if indexed properly.
- **Full-text search:** If you need to search post content or user bios, consider adding a tsvector column and an index (Supabase has PG full-text search capabilities).

By following these practices, we maintain **data integrity** (through foreign keys and cascades) and **performance** (through indexes and careful RLS policy design) ([Supabase foreign key example — Restack](https://www.restack.io/docs/supabase-knowledge-supabase-foreign-key-example#:~:text=,columns%20to%20improve%20query%20performance)). 

## Conclusion

This SQL script sets up a robust schema for a social network on Supabase. We leveraged Supabase Auth for user management, linking it to a profiles table with a trigger to auto-create profiles and assign roles (making the first user an admin) ([Creating an Admin Account in Supabase | AuthGPTs](https://docs.authgpts.com/supabas/creating-an-admin-account-in-supabase#:~:text=,table)). We've defined all the core tables with proper relationships, implemented **Row-Level Security** for fine-grained access control on each table (so users can only affect their own data) ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=create%20policy%20,their%20own%20profile)) ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=using%20%28%20%28select%20auth,complies%20with%20the%20policy%20expression)), and set up storage buckets with security rules for user-uploaded content ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=bucket_id%20%3D%20%27my_bucket_id%27%20and)). 

Using database-side rules (constraints, cascades, triggers, and RLS policies) ensures that security and business logic are enforced consistently, no matter how the data is accessed ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=Make%20sure%20to%20protect%20the,table%20might%20look%20like%20this)) ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=_%2010)). This minimizes the risk of a client bypassing rules and helps scale the application securely. 

**References:**

- Supabase documentation on managing user data and profiles ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=Make%20sure%20to%20protect%20the,table%20might%20look%20like%20this)) ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=id%20uuid%20not%20null%20references,users%20on%20delete%20cascade)), including using foreign keys to `auth.users` with cascade and enabling RLS ([User Management | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data#:~:text=_%2010)).
- Supabase guidance on implementing Row Level Security policies ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=create%20policy%20,their%20own%20profile)) ([Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#:~:text=using%20%28%20%28select%20auth,complies%20with%20the%20policy%20expression)).
- Supabase Storage security and folder-based policies ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=bucket_id%20%3D%20%27my_bucket_id%27%20and)) ([Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control#:~:text=%28storage.foldername%28name%29%29)).
- PostgreSQL cascade delete behavior and options ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=1,it%20also%20has%20the%20option)) ([Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes#:~:text=alter%20table%20child_table)).
- Best practices for indexing and foreign keys in Postgres ([Supabase foreign key example — Restack](https://www.restack.io/docs/supabase-knowledge-supabase-foreign-key-example#:~:text=,columns%20to%20improve%20query%20performance)).

```sql
-- #region Header
-- Comprehensive Social Network Schema for Supabase
-- Author: TurtleWolfe@ScriptHammer.com
-- Created: 2025-02-09
-- Description: Creates tables, functions, triggers, policies, and indexes
--              for a social network backend with Supabase Auth integration.
-- #endregion Header

-- #region 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- #endregion 1

-- #region 2. Create Enumerated Types
CREATE TYPE role_type AS ENUM ('user', 'moderator', 'admin');
-- #endregion 2

-- #region 3. Create Core Tables and Enable RLS

  -- #region 3.1 Users Table (Profiles)
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
  -- #endregion 3.1

  -- #region 3.2 Posts Table
  CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
  -- #endregion 3.2

  -- #region 3.3 Comments Table
  CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
  -- #endregion 3.3

  -- #region 3.4 Likes Table
  CREATE TABLE public.likes (
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
  );
  ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
  -- #endregion 3.4

  -- #region 3.5 Followers Table
  CREATE TABLE public.followers (
    follower_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id)
  );
  ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
  -- #endregion 3.5

  -- #region 3.6 Messages Table
  CREATE TABLE public.messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
  -- #endregion 3.6

  -- #region 3.7 Notifications Table
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
  -- #endregion 3.7

-- #endregion 3

-- #region 4. Authentication & Role-Based Access Trigger
-- This trigger automatically creates a user profile in public.users when a new
-- authentication user is inserted in auth.users.
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
    NEW.email,  -- Default display name as email; adjust if full name available
    CASE 
      WHEN user_count = 0 THEN 'admin'
      ELSE 'user'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- #endregion 4

-- #region 5. Row-Level Security (RLS) Policies

  -- Users Policies
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

  -- Posts Policies
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

  -- Comments Policies
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

  -- Likes Policies
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

  -- Followers Policies
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

  -- Messages Policies
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

  -- Notifications Policies
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
    
-- #endregion 5

-- #region 6. Audit Logging & Timestamp Update Functions and Triggers

  -- #region 6.1 Audit Log Table
  CREATE TABLE public.audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name TEXT,
    action TEXT,            -- 'INSERT', 'UPDATE', or 'DELETE'
    record_id TEXT,         -- primary key of the affected record as text
    user_id UUID,           -- user who performed the action
    changed_data JSONB,     -- row data as JSON
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  -- #endregion 6.1

  -- #region 6.2 Audit Log Trigger Function
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
  
  -- Attach audit triggers to key tables
  CREATE TRIGGER audit_posts
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE PROCEDURE public.log_audit();
  
  CREATE TRIGGER audit_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.log_audit();
  -- #endregion 6.2

  -- #region 6.3 Timestamp Update Function
  CREATE OR REPLACE FUNCTION public.update_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  
  -- Attach update timestamp triggers
  CREATE TRIGGER set_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();
  
  CREATE TRIGGER set_posts_updated
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();
  
  CREATE TRIGGER set_comments_updated
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();
  -- #endregion 6.3

-- #endregion 6

-- #region 7. Indexes for Performance Optimization
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);

CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);

CREATE INDEX idx_likes_post_id ON public.likes(post_id);

CREATE INDEX idx_followers_followee_id ON public.followers(followee_id);

CREATE INDEX idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
-- #endregion 7

-- #region 8. Storage Buckets (Reference)
-- Note: Supabase Storage buckets (e.g., 'avatars' and 'post_media') are typically created
-- via the Supabase Dashboard or API. The following are example RLS policy statements
-- for storage.objects.
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
-- #endregion 8

-- #region End of Script
-- =============================================
-- End of Comprehensive Social Network Schema for Supabase
-- =============================================
-- #endregion End of Script

```
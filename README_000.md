Below are **three** complete scripts, **in the order** you requested—first the **SQL** to initialize your unified backend schema, second the **Bash** to scaffold the Expo front end, and third the **SQL** to seed your sample data (including a dummy post).  

With these scripts, you’ll have:

1. **Script 1 (SQL)**: Creates the unified `contents` table (for top-level posts and replies), sets up `content_reactions`, and configures row-level security (RLS).  
2. **Script 2 (Bash)**: Sets up your Expo + TypeScript front end, referencing `contents` for posts.  
3. **Script 3 (SQL)**: Inserts sample users (admin, testers), plus dummy posts into `contents`.  

Make sure your `.env` (in the Expo app) matches the same Supabase project where you run Scripts 1 and 3. Then sign in as one of the testers (e.g., `testuser@example.com`) to see the dummy posts on the Home screen.

---

## Script 1: **SQL** – Backend Schema Initialization

```sql
-- =============================================================================
-- Script 1: Backend Schema Initialization for SupaBase with Realtime Chat Messaging,
-- Role Support, and Unified Content/Reaction System.
-- =============================================================================

-- 1. Enable pgcrypto extension (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the profiles table
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

-- 2a. Trigger function to set the role automatically (first user => admin)
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

DROP TRIGGER IF EXISTS set_role_if_first_trigger ON public.profiles;
CREATE TRIGGER set_role_if_first_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.set_role_if_first();

---------------------------------------------------------------
-- 3. Create unified contents table (for top-level posts/comments)
---------------------------------------------------------------
CREATE TABLE public.contents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    content text NOT NULL,
    parent_id uuid NULL,  -- if NULL => top-level post; else => a comment/reply
    edited boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_contents_user FOREIGN KEY (user_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_contents_parent FOREIGN KEY (parent_id)
        REFERENCES public.contents (id) ON DELETE CASCADE
);
CREATE INDEX idx_contents_user_id ON public.contents(user_id);
CREATE INDEX idx_contents_parent_id ON public.contents(parent_id);

---------------------------------------------------------------
-- 4. Create conversations table (chat sessions)
---------------------------------------------------------------
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

---------------------------------------------------------------
-- 5. Create messages table
---------------------------------------------------------------
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

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

---------------------------------------------------------------
-- 6. Create unified content_reactions table
---------------------------------------------------------------
CREATE TABLE public.content_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_content_reactions_content FOREIGN KEY (content_id)
        REFERENCES public.contents (id) ON DELETE CASCADE,
    CONSTRAINT fk_content_reactions_user FOREIGN KEY (user_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT unique_content_reaction UNIQUE (content_id, user_id)
);
CREATE INDEX idx_content_reactions_content_id ON public.content_reactions(content_id);
CREATE INDEX idx_content_reactions_user_id ON public.content_reactions(user_id);

---------------------------------------------------------------
-- 7. Create message_reactions table (unchanged)
---------------------------------------------------------------
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

---------------------------------------------------------------
-- 8. Other Extended Tables (friend_requests, friend_blocks, etc.)
---------------------------------------------------------------
CREATE TABLE public.friend_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending',
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

CREATE TABLE public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL,
    content_type text NOT NULL,
    content_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);

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

CREATE TABLE public.group_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    member_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'member',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_group_members_group FOREIGN KEY (group_id)
        REFERENCES public.groups (id) ON DELETE CASCADE,
    CONSTRAINT fk_group_members_member FOREIGN KEY (member_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_group_members_unique UNIQUE (group_id, member_id)
);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_member_id ON public.group_members(member_id);

CREATE TABLE public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    event_date timestamptz NOT NULL,
    created_by uuid NOT NULL,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_events_created_by FOREIGN KEY (created_by)
        REFERENCES public.profiles (id) ON DELETE CASCADE
);
CREATE INDEX idx_events_created_by ON public.events(created_by);

CREATE TABLE public.event_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    invitee_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_event_invitations_event FOREIGN KEY (event_id)
        REFERENCES public.events (id) ON DELETE CASCADE,
    CONSTRAINT fk_event_invitations_invitee FOREIGN KEY (invitee_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_event_invitations_unique UNIQUE (event_id, invitee_id)
);
CREATE INDEX idx_event_invitations_event_id ON public.event_invitations(event_id);
CREATE INDEX idx_event_invitations_invitee_id ON public.event_invitations(invitee_id);

CREATE TABLE public.media_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type text NOT NULL,
    content_id uuid NOT NULL,
    media_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_attachments_content ON public.media_attachments(content_type, content_id);

-- Content shares
CREATE TABLE public.content_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    content_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_content_shares_user FOREIGN KEY (user_id)
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_content_shares_content FOREIGN KEY (content_id)
        REFERENCES public.contents (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_content_shares_user_id ON public.content_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_content_shares_content_id ON public.content_shares(content_id);

-- Notifications
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    type text NOT NULL,
    reference_id uuid,
    message text,
    read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

---------------------------------------------------------------
-- 9. Trigger functions to auto-update updated_at columns
---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_contents_updated_at
BEFORE UPDATE ON public.contents
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
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

-- Notifications update trigger
CREATE OR REPLACE FUNCTION public.update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notifications_updated_at_trigger ON public.notifications;
CREATE TRIGGER update_notifications_updated_at_trigger
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE PROCEDURE public.update_notifications_updated_at();

---------------------------------------------------------------
-- 10. Create the public "users" view
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
-- 11. Enable Row Level Security (RLS) and define policies
---------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles insert policy" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Profiles update policy" ON public.profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles delete policy" ON public.profiles FOR DELETE USING (auth.uid() = id);

ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contents select policy" ON public.contents FOR SELECT USING (true);
CREATE POLICY "Contents insert policy" ON public.contents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Contents update policy" ON public.contents FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Contents delete policy" ON public.contents FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.content_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ContentReactions select policy" ON public.content_reactions FOR SELECT USING (true);
CREATE POLICY "ContentReactions insert policy" ON public.content_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ContentReactions delete policy" ON public.content_reactions FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conversations select policy" ON public.conversations
FOR SELECT USING (auth.uid() = user1 OR auth.uid() = user2);
CREATE POLICY "Conversations insert policy" ON public.conversations
FOR INSERT WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);
CREATE POLICY "Conversations update policy" ON public.conversations
FOR UPDATE USING (auth.uid() = user1 OR auth.uid() = user2)
  WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);
CREATE POLICY "Conversations delete policy" ON public.conversations
FOR DELETE USING (auth.uid() = user1 OR auth.uid() = user2);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages select policy" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.user1 = auth.uid() OR c.user2 = auth.uid())
  )
);
CREATE POLICY "Messages insert policy" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Messages update policy" ON public.messages FOR UPDATE USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Messages delete policy" ON public.messages FOR DELETE USING (auth.uid() = sender_id);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FriendRequests select policy" ON public.friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "FriendRequests insert policy" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "FriendRequests delete policy" ON public.friend_requests FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

ALTER TABLE public.friend_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FriendBlocks select policy" ON public.friend_blocks FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "FriendBlocks insert policy" ON public.friend_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "FriendBlocks delete policy" ON public.friend_blocks FOR DELETE USING (auth.uid() = blocker_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reports select policy" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Reports insert policy" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reports delete policy" ON public.reports FOR DELETE USING (auth.uid() = reporter_id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups select policy" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Groups insert policy" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Groups update policy" ON public.groups FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Groups delete policy" ON public.groups FOR DELETE USING (auth.uid() = created_by);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GroupMembers select policy" ON public.group_members FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "GroupMembers insert policy" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = member_id);
CREATE POLICY "GroupMembers delete policy" ON public.group_members FOR DELETE USING (auth.uid() = member_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events select policy" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events insert policy" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Events update policy" ON public.events FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Events delete policy" ON public.events FOR DELETE USING (auth.uid() = created_by);

ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EventInvitations select policy" ON public.event_invitations FOR SELECT USING (auth.uid() = invitee_id);
CREATE POLICY "EventInvitations insert policy" ON public.event_invitations FOR INSERT WITH CHECK (auth.uid() = invitee_id);
CREATE POLICY "EventInvitations delete policy" ON public.event_invitations FOR DELETE USING (auth.uid() = invitee_id);

ALTER TABLE public.media_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MediaAttachments select policy" ON public.media_attachments FOR SELECT USING (true);
CREATE POLICY "MediaAttachments insert policy" ON public.media_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "MediaAttachments delete policy" ON public.media_attachments FOR DELETE USING (true);

ALTER TABLE public.content_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ContentShares select policy" ON public.content_shares FOR SELECT USING (true);
CREATE POLICY "ContentShares insert policy" ON public.content_shares FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ContentShares delete policy" ON public.content_shares FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MessageReactions select policy" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "MessageReactions insert policy" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "MessageReactions delete policy" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications select policy" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifications insert policy" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notifications update policy" ON public.notifications FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notifications delete policy" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

---------------------------------------------------------------
-- 12. Publish tables for realtime
---------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =============================================================================
-- End of Script 1
-- =============================================================================
```

---

## Script 2: **Bash** – Expo Front-End Setup (Unified `contents` Model)

Save this as `setup.sh` (or similar), make it executable (`chmod +x setup.sh`), and run it from your project root. It will:

- Create a new Expo app (TypeScript)
- Install dependencies (Zustand, Supabase JS v2, etc.)
- Scaffold screens referencing the `contents` table for top-level posts (`parent_id` = null)
- Set up row-level security-friendly queries

Make sure your `.env` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` matching the same project where you ran Script 1.

```bash
#!/usr/bin/env bash
set -eo pipefail

##############################################
# Script 2: Expo Setup with Unified "contents" Table
##############################################

#region Environment Variables and Pre-Setup
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
else
  echo "ERROR: .env file not found."
  echo "Please create one with at least the following content:"
  echo 'APP_NAME="ScriptHammer"'
  echo 'EXPO_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"'
  echo 'EXPO_PUBLIC_SUPABASE_ANON_KEY="YOUR-ANON-KEY"'
  echo 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"'
  exit 1
fi

required_vars=("APP_NAME" "EXPO_PUBLIC_SUPABASE_URL" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set in the .env file."
    exit 1
  fi
done
#endregion

#region Create Expo App (TypeScript)
echo "🚀 Creating Expo app: $APP_NAME"
npx create-expo-app "$APP_NAME"

echo "📂 Entering project directory"
cd "$APP_NAME" || { echo "ERROR: Failed to enter directory '$APP_NAME'"; exit 1; }

echo "N" | npm run reset-project
rm -rf app-example
rm -f App.js App.tsx
#endregion

#region Check Local Expo CLI Installation
echo "🔍 Checking for Expo CLI in local dependencies..."
if ! npx expo --version >/dev/null 2>&1; then
  echo "Local Expo CLI not found. Installing expo-cli as a dev dependency..."
  npm install --save-dev expo-cli
  if ! npx expo --version >/dev/null 2>&1; then
    echo "ERROR: Local Expo CLI installation failed. Please check your npm setup."
    exit 1
  else
    echo "Local Expo CLI installed: $(npx expo --version)"
  fi
else
  echo "Local Expo CLI found: $(npx expo --version)"
fi
#endregion

#region Install Dependencies
echo "📦 Installing dependencies..."

# Production dependencies (installed via Expo CLI)
prod_deps=(
  "zustand"
  "@supabase/supabase-js@2"
  "@react-native-async-storage/async-storage"
  "react-native-url-polyfill"
  "react-hook-form"
  "yup"
  "react-native-safe-area-context"
  "expo-status-bar"
  "nativewind"
  "react-native-picker-select"
  "@react-google-maps/api"
  "expo-location"
  "react-native-maps"
)

# Dev dependencies (installed via npm)
dev_deps=( "tailwindcss@3.3.2" )

echo "Installing production dependencies with Expo CLI..."
npx expo install "${prod_deps[@]}"

echo "Installing dev dependencies using npm..."
npm install --save-dev "${dev_deps[@]}"
#endregion

#region Create Directory Structure
echo "📁 Creating directory structure..."
dir_structure=(
  ".env.local"
  "nativewind-env.d.ts"
  "src/lib/"
  "src/lib/supabase.ts"
  "src/store/"
  "src/store/useAuthStore.ts"
  "src/components/"
  "src/context/"
  "src/utils/"
  "app/"
  "app/_layout.tsx"
  "app/error.tsx"
  "app/global.css"
  "app/loading.tsx"
  "app/not-found.tsx"
  "app/index.tsx"
  "app/(auth)/"
  "app/(auth)/_layout.tsx"
  "app/(auth)/signIn.tsx"
  "app/(auth)/signUp.tsx"
  "app/(tabs)/"
  "app/(tabs)/_layout.tsx"
  "app/(tabs)/home.tsx"
  "app/(tabs)/create.tsx"
  "app/(tabs)/explore.tsx"
  "app/(tabs)/groups.tsx"
  "app/(tabs)/map.tsx"
  "app/(tabs)/chats.tsx"
  "app/(tabs)/cues.tsx"
  "app/(tabs)/profile.tsx"
  "app/profileEdit.tsx"
  "src/components/ChatMessage.tsx"
  "src/components/MessageInput.tsx"
)
for item in "${dir_structure[@]}"; do
  if [[ $item == */ ]]; then
    mkdir -p "$item"
  else
    mkdir -p "$(dirname "$item")"
    touch "$item"
  fi
done
#endregion

#region Create nativewind-env.d.ts
cat > "nativewind-env.d.ts" << 'EOF'
/// <reference types="nativewind/types" />
EOF
#endregion

#region Scaffold Global CSS
cat > "app/global.css" << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Steampunk-ish color variables */
:root {
  --bg-light: #f0e6d2;
  --text-light: #3b302a;
  --bg-dark: #3c2e2b;
  --text-dark: #d4bfa3;
  --text-active: #5a4a42;
}

html, body {
  background-color: var(--bg-light);
  color: var(--text-light);
}

.dark html, .dark body {
  background-color: var(--bg-dark);
  color: var(--text-dark);
}

.bg-steampunk-light {
  background-color: var(--bg-light);
}
.dark .bg-steampunk-light {
  background-color: var(--bg-dark);
}

.btn {
  @apply px-4 py-2 rounded-lg font-medium;
  @apply bg-[#c0a080] text-[#3b302a] border-2 border-[#3b302a];
  @apply dark:bg-[#5a4a42] dark:text-[#d4bfa3] dark:border-[#d4bfa3];
  @apply active:opacity-80 active:scale-95 transition-all;
}

.link {
  @apply underline;
  color: var(--text-light);
}
.dark .link {
  color: var(--text-dark);
}

.input-shadow {
  -webkit-box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
  -moz-box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
  box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
}

/* Updated comment meta styles with increased specificity */
html body .comment-meta {
  color: #4B5563 !important;  /* Tailwind gray-600 */
  font-size: 0.75rem !important; /* text-xs */
}
.dark html body .comment-meta {
  color: #D1D5DB !important;  /* Tailwind gray-300 */
}
EOF
#endregion

#region Scaffold Tailwind Config
cat > "tailwind.config.js" << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        light: {
          primary: '#c0a080',
          secondary: '#3b302a',
        },
        dark: {
          primary: '#5a4a42',
          secondary: '#d4bfa3',
        },
      },
    },
  },
  presets: [require("nativewind/preset")],
  plugins: [],
}
EOF
#endregion

#region Scaffold Metro Config
cat > "metro.config.js" << 'EOF'
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-maps' && platform === 'web') {
    return {
      filePath: './src/components/MapViewWrapper.web.tsx',
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./app/global.css" });
EOF
#endregion

#region Scaffold Babel Config
cat > "babel.config.js" << 'EOF'
module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel"
    ],
    plugins: [
      "react-native-reanimated/plugin"
    ],
  };
};
EOF
#endregion

#region Scaffold Custom Button Component
cat > "src/components/CustomButton.tsx" << 'EOF'
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
}

export function CustomButton({ title, onPress }: CustomButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} className="btn">
      <Text className="text-center">{title}</Text>
    </TouchableOpacity>
  );
}
EOF
#endregion

#region Scaffold MapViewWrapper Components
cat > "src/components/MapViewWrapper.native.tsx" << 'EOF'
import MapView from 'react-native-maps';

export default function MapViewWrapper(props: any) {
  return <MapView {...props} />;
}

export function Marker(props: any) {
  return <MapView.Marker {...props} />;
}
EOF

cat > "src/components/MapViewWrapper.web.tsx" << 'EOF'
import React from 'react';
import { GoogleMap, LoadScript, Marker as GMarker } from '@react-google-maps/api';

export default function MapViewWrapper(props: any) {
  return (
    <LoadScript googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{
          lat: props.initialRegion?.latitude || 0,
          lng: props.initialRegion?.longitude || 0,
        }}
        zoom={15}
      >
        {props.children}
      </GoogleMap>
    </LoadScript>
  );
}

export function Marker(props: any) {
  return <GMarker position={{ lat: props.coordinate.latitude, lng: props.coordinate.longitude }} />;
}
EOF
#endregion

#region Scaffold Theme Context
cat > "src/context/ThemeContext.tsx" << 'EOF'
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, Platform } from 'react-native';

const ThemeContext = createContext<{ theme: string; toggleTheme: () => void } | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = Appearance.getColorScheme() || 'light';
  const [theme, setTheme] = useState(systemColorScheme);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme || 'light');
    });
    return () => subscription.remove();
  }, []);

  if (Platform.OS === 'web') {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
EOF
#endregion

#region Scaffold Root Layout
cat > "app/_layout.tsx" << 'EOF'
import React, { useEffect } from 'react';
import { useRouter, usePathname, Slot } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { ActivityIndicator, View } from 'react-native';
import { ThemeProvider } from '../src/context/ThemeContext';
import "./global.css";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user && pathname && !pathname.startsWith('/signIn') && !pathname.startsWith('/signUp')) {
      router.replace('/signIn');
    }
    if (user && pathname && (pathname.startsWith('/signIn') || pathname.startsWith('/signUp'))) {
      router.replace('/home');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
EOF
#endregion

#region Scaffold Auth Layout
cat > "app/(auth)/_layout.tsx" << 'EOF'
import { Slot } from 'expo-router';
import "../global.css";

export default function AuthLayout() {
  return <Slot />;
}
EOF
#endregion

#region Scaffold Tabs Layout
cat > "app/(tabs)/_layout.tsx" << 'EOF'
import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import "../global.css";

export default function TabLayout() {
  const { theme } = useTheme();
  const headerBackground = theme === 'light' ? 'var(--bg-dark)' : 'var(--bg-light)';
  const headerText = theme === 'light' ? 'var(--text-dark)' : 'var(--text-light)';
  const inactiveColor = theme === 'light' ? 'var(--text-dark)' : 'var(--text-light)';
  const activeColor = 'var(--text-active)';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: headerBackground },
        headerTintColor: headerText,
        tabBarStyle: { backgroundColor: headerBackground },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
      }}
    >
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="create" 
        options={{ 
          title: 'Create',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="explore" 
        options={{ 
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="groups" 
        options={{ 
          title: 'Groups',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="map" 
        options={{ 
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="chats" 
        options={{ 
          title: 'Chats',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="cues" 
        options={{ 
          title: 'Cues',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }} 
      />
    </Tabs>
  );
}
EOF
#endregion

#region Scaffold Root Index Screen
cat > "app/index.tsx" << 'EOF'
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      router.replace('/home');
    }
  }, [mounted, router]);

  return null;
}
EOF
#endregion

#region Scaffold Additional Screens
cat > "app/error.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function ErrorScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>An error occurred.</Text>
    </View>
  );
}
EOF

cat > "app/loading.tsx" << 'EOF'
import React from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
EOF

cat > "app/not-found.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Page not found.</Text>
    </View>
  );
}
EOF
#endregion

#region Scaffold Auth Screens
cat > "app/(auth)/signIn.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as Yup from 'yup';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { CustomButton } from '../../src/components/CustomButton';

const signInSchema = Yup.object().shape({
  email: Yup.string().email('Please enter a valid email address.').required('Email is required.'),
  password: Yup.string().required('Password is required.'),
});

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [serverError, setServerError] = useState('');
  const { setUser } = useAuthStore();
  const router = useRouter();

  const handleSignIn = async () => {
    setErrors({});
    setServerError('');
    try {
      await signInSchema.validate({ email, password }, { abortEarly: false });
    } catch (validationError: any) {
      if (validationError.inner) {
        const newErrors: any = {};
        validationError.inner.forEach((err: any) => {
          if (err.path) newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      }
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setServerError(error.message);
      } else if (data.session) {
        setUser(data.session.user);
      } else {
        setServerError('No session returned. Please try again.');
      }
    } catch (err) {
      setServerError('An error occurred during sign in. Please try again later.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign In</Text>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors((prev: any) => ({ ...prev, email: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.email ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          autoCapitalize="none"
          keyboardType="email-address"
          className="input-shadow"
        />
        {errors.email && <Text style={{ color: 'red', marginTop: 4 }}>{errors.email}</Text>}
      </View>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors((prev: any) => ({ ...prev, password: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.password ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          secureTextEntry
          className="input-shadow"
        />
        {errors.password && <Text style={{ color: 'red', marginTop: 4 }}>{errors.password}</Text>}
      </View>
      {serverError ? <Text style={{ color: 'red', marginBottom: 12 }}>{serverError}</Text> : null}
      <CustomButton title="Sign In" onPress={handleSignIn} />
      <Text onPress={() => router.push('/signUp')} className="link mt-4 text-center">
        Don't have an account? Sign Up
      </Text>
    </View>
  );
}
EOF

cat > "app/(auth)/signUp.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import * as Yup from 'yup';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { CustomButton } from '../../src/components/CustomButton';

const signUpSchema = Yup.object().shape({
  email: Yup.string().email('Please enter a valid email address.').required('Email is required.'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters long.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, 'Password must contain uppercase, lowercase, number, and special character.')
    .required('Password is required.'),
});

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [serverError, setServerError] = useState('');
  const { setUser } = useAuthStore();

  const handleSignUp = async () => {
    setErrors({});
    setServerError('');
    try {
      await signUpSchema.validate({ email, password }, { abortEarly: false });
    } catch (validationError: any) {
      if (validationError.inner) {
        const newErrors: any = {};
        validationError.inner.forEach((err: any) => {
          if (err.path) newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      }
      return;
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setServerError(error.message);
      } else if (data.user) {
        setUser(data.user);
      } else {
        setServerError('Sign up failed. Please try again.');
      }
    } catch (err) {
      setServerError('An error occurred during sign up. Please try again later.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign Up</Text>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors((prev: any) => ({ ...prev, email: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.email ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          autoCapitalize="none"
          keyboardType="email-address"
          className="input-shadow"
        />
        {errors.email && <Text style={{ color: 'red', marginTop: 4 }}>{errors.email}</Text>}
      </View>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors((prev: any) => ({ ...prev, password: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.password ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          secureTextEntry
          className="input-shadow"
        />
        {errors.password && <Text style={{ color: 'red', marginTop: 4 }}>{errors.password}</Text>}
      </View>
      {serverError ? <Text style={{ color: 'red', marginBottom: 12 }}>{serverError}</Text> : null}
      <CustomButton title="Sign Up" onPress={handleSignUp} />
    </View>
  );
}
EOF
#endregion

#region Utils - Supabase Helpers
cat > "src/utils/supabaseHelpers.ts" << 'EOF'
import { supabase } from '../lib/supabase';

/**
 * Fetches the profile for a given content record if the displayName is missing.
 * This ensures that the content object has a joined 'profiles' field with at least displayName.
 */
export async function fetchProfileForContent(content: any): Promise<any> {
  if (!content.profiles || !content.profiles.displayName) {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('displayName')
      .eq('id', content.user_id)
      .maybeSingle();
    if (!error && profileData) {
      content.profiles = profileData;
    }
  }
  return content;
}
EOF
#endregion

#region CommentsSection Component
cat > "src/components/CommentsSection.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { LikeButton } from './LikeButton';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
  profiles?: { displayName: string };
}

interface CommentsSectionProps {
  postId: string; // top-level content ID
  hidePostReply?: boolean;
}

export function CommentsSection({ postId, hidePostReply = false }: CommentsSectionProps) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Fetch all contents that have parent_id != null (comments), then we filter them in code.
  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contents')
        .select('*, profiles!inner(displayName)')
        .neq('parent_id', null);
      if (error) {
        console.error('Error fetching comments:', error);
      } else if (data) {
        setComments(data as Comment[]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const payload = {
        user_id: user.id,
        content: newComment,
        parent_id: replyTo ? replyTo.id : postId,
      };
      const { error } = await supabase.from('contents').insert([payload]).single();
      if (error) {
        console.error('Error submitting comment:', error);
      } else {
        setNewComment('');
        setReplyTo(null);
        setShowInput(false);
        fetchComments();
      }
    } catch (err) {
      console.error('Unexpected error submitting comment:', err);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editingContent.trim()) return;
    try {
      const { error } = await supabase
        .from('contents')
        .update({ content: editingContent })
        .match({ id: commentId });
      if (error) {
        console.error('Error updating comment:', error);
        Alert.alert('Update Error', error.message);
      } else {
        setEditingCommentId(null);
        setEditingContent('');
        fetchComments();
      }
    } catch (err) {
      console.error('Unexpected error updating comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to delete this comment?')) return;
    }
    try {
      const { error } = await supabase
        .from('contents')
        .delete()
        .match({ id: commentId, user_id: user.id });
      if (error) {
        if (Platform.OS === 'web') {
          alert('Deletion Failed: ' + error.message);
        } else {
          Alert.alert('Delete Error', error.message);
        }
      } else {
        fetchComments();
      }
    } catch (err: any) {
      const message = err.message || 'Deletion failed.';
      if (Platform.OS === 'web') {
        alert('Deletion Failed: ' + message);
      } else {
        Alert.alert('Deletion Failed', message);
      }
    }
  };

  // Recursive function to render a comment and its replies
  const renderCommentItem = (comment: Comment, level: number = 0) => {
    const replies = comments.filter((c) => c.parent_id === comment.id);
    return (
      <View key={comment.id} style={{ marginLeft: level * 16 }} className="mt-1">
        {editingCommentId === comment.id ? (
          <View>
            <TextInput
              value={editingContent}
              onChangeText={setEditingContent}
              style={{ borderWidth: 1, borderColor: '#ccc', padding: 4, borderRadius: 4 }}
              multiline
            />
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              <TouchableOpacity onPress={() => handleSaveEdit(comment.id)}>
                <Text className="text-xs text-blue-500">Save</Text>
              </TouchableOpacity>
              <Text style={{ marginHorizontal: 8 }}>|</Text>
              <TouchableOpacity onPress={() => { setEditingCommentId(null); setEditingContent(''); }}>
                <Text className="text-xs text-red-500">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            {user && comment.user_id === user.id ? (
              <TouchableOpacity onPress={() => { setEditingCommentId(comment.id); setEditingContent(comment.content); }}>
                <Text className="text-base text-[#3b302a] dark:text-[#d4bfa3]">
                  {comment.content}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text className="text-base text-[#3b302a] dark:text-[#d4bfa3]">
                {comment.content}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <LikeButton entityId={comment.id} entityType="content" />
              <Text className="comment-meta" style={{ marginLeft: 4 }}>
                {comment.profiles?.displayName || 'Unknown'} • {new Date(comment.created_at).toLocaleString()}
              </Text>
              {user && comment.user_id === user.id && (
                <>
                  <Text style={{ marginHorizontal: 8 }}>|</Text>
                  <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                    <Text className="text-xs text-blue-500">Delete</Text>
                  </TouchableOpacity>
                </>
              )}
              <Text style={{ marginHorizontal: 8 }}>|</Text>
              <TouchableOpacity onPress={() => { setReplyTo(comment); setShowInput(true); }}>
                <Text className="text-xs text-blue-500 dark:text-blue-400">Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {replies.map((reply) => renderCommentItem(reply, level + 1))}
      </View>
    );
  };

  const topLevelComments = comments.filter((c) => c.parent_id === postId);

  return (
    <View className="p-4 border-t border-gray-300 dark:border-gray-600 mt-2">
      {loading ? (
        <Text className="text-xs text-gray-600 dark:text-gray-300">Loading comments...</Text>
      ) : (
        <FlatList
          data={topLevelComments}
          renderItem={({ item }) => renderCommentItem(item)}
          keyExtractor={(item) => item.id}
        />
      )}
      {!hidePostReply && !showInput && (
        <TouchableOpacity onPress={() => setShowInput(true)}>
          <Text className="text-xs text-blue-500 mt-2">Reply</Text>
        </TouchableOpacity>
      )}
      {showInput && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          {replyTo && (
            <View style={{ marginRight: 8 }}>
              <Text className="comment-meta">Replying to: {replyTo.content}</Text>
            </View>
          )}
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Write a comment..."
            className="flex-1 border border-gray-300 dark:border-gray-500 p-2 rounded mr-2"
            placeholderTextColor="#888"
          />
          <TouchableOpacity onPress={handleSubmitComment}>
            <Text className="text-blue-500 text-xs">Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowInput(false); setReplyTo(null); }}>
            <Text className="text-xs text-red-500" style={{ marginLeft: 8 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
export default CommentsSection;
EOF
#endregion

#region LikeButton Component
cat > "src/components/LikeButton.tsx" << 'EOF'
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

interface LikeButtonProps {
  entityId: string;
  entityType?: 'message' | 'content';
}

export function LikeButton({ entityId, entityType = 'content' }: LikeButtonProps) {
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const tableName = (entityType === 'message') ? 'message_reactions' : 'content_reactions';
  const columnName = (entityType === 'message') ? 'message_id' : 'content_id';

  const fetchLikes = async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(columnName, entityId);
      if (error) {
        console.error('Error fetching likes:', error);
        return;
      }
      setLikeCount(data.length);
      const userLike = data.find((r: any) => r.user_id === user?.id);
      setLiked(!!userLike);
    } catch (err) {
      console.error('Unexpected error fetching likes:', err);
    }
  };

  useEffect(() => {
    fetchLikes();
  }, [entityId, entityType]);

  const showError = (message: string) => {
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('Like Error', message);
    }
  };

  const toggleLike = async () => {
    if (!user) {
      showError('You must be logged in to like this item.');
      return;
    }
    try {
      if (liked) {
        // Unlike
        const { error } = await supabase
          .from(tableName)
          .delete()
          .match({ [columnName]: entityId, user_id: user.id });
        if (error) {
          console.error('Error unliking:', error);
          showError(error.message);
        } else {
          setLiked(false);
          setLikeCount((prev) => prev - 1);
        }
      } else {
        // Like
        const newReaction = {
          user_id: user.id,
          reaction: 'like',
        };
        newReaction[columnName] = entityId;
        const { error } = await supabase
          .from(tableName)
          .insert([newReaction]);
        if (error) {
          console.error('Error liking:', error);
          showError(error.message);
        } else {
          setLiked(true);
          setLikeCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error('Unexpected error toggling like:', err);
      showError('An unexpected error occurred while toggling like.');
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={toggleLike}>
      <Text style={[styles.text, liked && styles.liked]}>
        {liked ? '👍' : '👍'} {likeCount}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: 0,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    color: '#333',
  },
  liked: {
    color: '#007AFF',
  },
});
EOF
#endregion

#region HOME SCREEN
cat > "app/(tabs)/home.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Alert, Platform, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { fetchProfileForContent } from '../../src/utils/supabaseHelpers';
import { CommentsSection } from '../../src/components/CommentsSection';
import { LikeButton } from '../../src/components/LikeButton';

interface Post {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  edited: boolean;
  user_id: string;
  profiles?: { displayName: string };
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [postErrors, setPostErrors] = useState<{ [key: string]: string }>({});
  const [activePostReplyId, setActivePostReplyId] = useState<string | null>(null);
  const [postReplyContent, setPostReplyContent] = useState('');

  const fetchPosts = async () => {
    setLoading(true);
    try {
      // Fetch only top-level posts (parent_id is null)
      const { data, error } = await supabase
        .from('contents')
        .select('*, profiles!inner(displayName)')
        .is('parent_id', null)  -- only top-level
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('Error fetching posts:', error);
      } else if (data) {
        const enriched = await Promise.all(
          data.map((post: Post) => fetchProfileForContent(post))
        );
        setPosts(enriched);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Realtime subscription for new/updated/deleted top-level posts
  useEffect(() => {
    const channel = supabase
      .channel('contents-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contents' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as Post;
            // Only add if it's top-level
            if (newRow.parent_id === null) {
              fetchProfileForContent(newRow).then((updatedPost) => {
                setPosts((prev) => [updatedPost, ...prev]);
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as Post;
            if (updatedRow.parent_id === null) {
              fetchProfileForContent(updatedRow).then((enrichedRow) => {
                setPosts((prev) =>
                  prev.map((p) => (p.id === enrichedRow.id ? enrichedRow : p))
                );
              });
            }
          } else if (payload.eventType === 'DELETE') {
            // The "old" field has the deleted row
            if (payload.old.parent_id === null) {
              setPosts((prev) =>
                prev.filter((p) => p.id !== payload.old.id)
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to delete this post?')) return;
    }
    try {
      const { error } = await supabase
        .from('contents')
        .delete()
        .match({ id: postId, user_id: user?.id });
      if (error) {
        if (Platform.OS === 'web') {
          alert('Deletion Failed: ' + error.message);
        } else {
          Alert.alert('Deletion Failed', error.message);
        }
        setPostErrors((prev) => ({ ...prev, [postId]: error.message }));
      } else {
        setPostErrors((prev) => {
          const updated = { ...prev };
          delete updated[postId];
          return updated;
        });
      }
    } catch (err: any) {
      const message = err.message || 'Deletion failed.';
      if (Platform.OS === 'web') {
        alert('Deletion Failed: ' + message);
      } else {
        Alert.alert('Deletion Failed', message);
      }
      setPostErrors((prev) => ({ ...prev, [postId]: message }));
    }
  };

  const handleSubmitPostReply = async () => {
    if (!postReplyContent.trim()) return;
    try {
      const payload = {
        user_id: user.id,
        content: postReplyContent,
        parent_id: activePostReplyId,
      };
      const { error } = await supabase
        .from('contents')
        .insert([payload])
        .single();
      if (error) {
        console.error('Error submitting post reply:', error);
      } else {
        setPostReplyContent('');
        setActivePostReplyId(null);
        fetchPosts(); // re-fetch to show new comment
      }
    } catch (err) {
      console.error('Unexpected error submitting post reply:', err);
    }
  };

  const renderPost = ({ item }: { item: Post }) => {
    const posterName = item.profiles?.displayName || 'Unknown';
    const timestamp = item.edited
      ? `${new Date(item.updated_at).toLocaleString()} (edited)`
      : new Date(item.created_at).toLocaleString();

    return (
      <View className="p-4 border-b border-gray-300">
        <Text className="text-[#3b302a] dark:text-[#d4bfa3] text-base">{item.content}</Text>
        <Text className="text-xs text-gray-600 mt-1">Posted by: {posterName}</Text>
        <Text className="text-xs text-gray-600 mt-1">{timestamp}</Text>
        {user && item.user_id === user.id && (
          <View style={{ flexDirection: 'row', marginTop: 4, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push(`/create?id=${item.id}`)}>
              <Text className="text-xs text-blue-500">Edit</Text>
            </TouchableOpacity>
            <Text style={{ marginHorizontal: 8 }}>|</Text>
            <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
              <Text className="text-xs text-blue-500">Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        {user && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <LikeButton entityId={item.id} entityType="content" />
            <TouchableOpacity
              onPress={() => setActivePostReplyId(item.id === activePostReplyId ? null : item.id)}
            >
              <Text style={{ fontSize: 12, color: '#007AFF', marginLeft: 8 }}>Reply</Text>
            </TouchableOpacity>
          </View>
        )}
        {activePostReplyId === item.id && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput
              value={postReplyContent}
              onChangeText={setPostReplyContent}
              placeholder="Write a reply..."
              style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 4, marginRight: 8 }}
              placeholderTextColor="#888"
            />
            <TouchableOpacity onPress={handleSubmitPostReply}>
              <Text style={{ fontSize: 12, color: '#007AFF' }}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setActivePostReplyId(null); setPostReplyContent(''); }}>
              <Text style={{ fontSize: 12, color: 'red', marginLeft: 8 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        <CommentsSection postId={item.id} hidePostReply={true} />
        {postErrors[item.id] && (
          <Text style={{ color: 'red', marginTop: 4 }}>
            {postErrors[item.id]}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-steampunk-light">
      {loading && posts.length === 0 ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
EOF
#endregion

#region Combined CREATE/EDIT SCREEN
cat > "app/(tabs)/create.tsx" << 'EOF'
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CustomButton } from '../../src/components/CustomButton';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function CreateEditPostScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchPost() {
      if (id) {
        const { data, error } = await supabase
          .from('contents')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();
        if (error) {
          setError(error.message);
        } else if (data) {
          setContent(data.content);
        }
      }
    }
    fetchPost();
  }, [id, user]);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Please enter some content for your post.');
      return;
    }
    setLoading(true);
    setError('');
    if (id) {
      // Editing existing post
      const { error } = await supabase
        .from('contents')
        .update({ content, edited: true })
        .match({ id, user_id: user.id });
      if (error) {
        setError(error.message);
      } else {
        if (Platform.OS === 'web') {
          window.alert('Post Updated: Your post has been updated successfully.');
          router.back();
        } else {
          Alert.alert('Post Updated', 'Your post has been updated successfully.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
        }
      }
    } else {
      // Creating a new post
      const { error } = await supabase
        .from('contents')
        .insert([{ user_id: user.id, content, parent_id: null }])
        .single();
      if (error) {
        setError(error.message);
      } else {
        if (Platform.OS === 'web') {
          window.alert('Post Created: Your post has been created successfully.');
          router.back();
        } else {
          Alert.alert('Post Created', 'Your post has been created successfully.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
        }
      }
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-steampunk-light p-4">
      <Text className="text-xl mb-4 text-[#3b302a] dark:text-[#d4bfa3]">
        {id ? 'Edit Your Post' : 'Compose New Post'}
      </Text>
      {error ? <Text className="text-red-500 mb-3">{error}</Text> : null}
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="What's on your mind?"
        placeholderTextColor="#5a4a42"
        className="border border-gray-300 dark:border-gray-600 p-2 rounded mb-4 text-[#3b302a] dark:text-[#d4bfa3]"
        style={{ minHeight: 100, textAlignVertical: 'top' }}
        multiline
      />
      <CustomButton
        title={loading ? (id ? 'Saving Changes...' : 'Posting...') : (id ? 'Save Changes' : 'Submit Post')}
        onPress={handleSave}
      />
      <CustomButton title="Cancel" onPress={() => router.back()} />
    </View>
  );
}
EOF
#endregion

#region EXPLORE SCREEN
cat > "app/(tabs)/explore.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function ExploreScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Explore Screen</Text>
    </View>
  );
}
EOF
#endregion

#region GROUPS SCREEN
cat > "app/(tabs)/groups.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function GroupsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Groups Screen</Text>
    </View>
  );
}
EOF
#endregion

#region MAP SCREEN
cat > "app/(tabs)/map.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from '../../src/components/MapViewWrapper';
import * as Location from 'expo-location';

export default function MapScreen() {
  const [location, setLocation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.container}>
        <Text style={styles.infoText}>Fetching location...</Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords;
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker coordinate={{ latitude, longitude }} title="You are here" />
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0e6d2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  infoText: {
    color: '#3b302a',
    fontSize: 16,
  },
});
EOF
#endregion

#region CHATS SCREEN
cat > "app/(tabs)/chats.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { ChatMessage } from '../../src/components/ChatMessage';
import { MessageInput } from '../../src/components/MessageInput';

export default function ChatsScreen() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    async function fetchContacts() {
      const { data, error } = await supabase.from('users').select('*');
      if (error) {
        console.error('Error fetching contacts:', error);
      } else if (data) {
        const otherUsers = data.filter((u: any) => u.id !== user.id);
        setContacts(otherUsers);
      }
    }
    fetchContacts();
  }, [user]);

  useEffect(() => {
    if (!selectedContact) return;
    async function fetchOrCreateConversation() {
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(user1.eq.${user.id},user2.eq.${selectedContact.id}),and(user1.eq.${selectedContact.id},user2.eq.${user.id})`)
        .maybeSingle();
      let convId = '';
      if (existingConversation) {
        convId = existingConversation.id;
      } else {
        const { data: newConversation, error: insertError } = await supabase
          .from('conversations')
          .insert({
            user1: user.id,
            user2: selectedContact.id,
          })
          .select('*')
          .maybeSingle();
        if (insertError) {
          console.error('Error creating conversation:', insertError);
          return;
        }
        convId = newConversation.id;
      }
      setConversationId(convId);
    }
    fetchOrCreateConversation();
  }, [selectedContact, user]);

  useEffect(() => {
    if (!conversationId) return;
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Error fetching messages:', error);
      } else if (data) {
        setMessages(data);
      }
    }
    fetchMessages();

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = async (text: string) => {
    if (!conversationId || text.trim() === '') return;
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text,
    });
    if (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <View className="flex-1 bg-steampunk-light">
      <RNPickerSelect
        onValueChange={(value) => {
          const contact = contacts.find((c) => c.id === value);
          setSelectedContact(contact);
        }}
        value={selectedContact ? selectedContact.id : ''}
        placeholder={{ label: 'Select a contact', value: '' }}
        items={contacts.map((contact) => ({
          label: contact.displayName || contact.email,
          value: contact.id,
        }))}
        style={{
          inputIOS: { backgroundColor: '#fff', padding: 12, margin: 8 },
          inputAndroid: { backgroundColor: '#fff', padding: 12, margin: 8 },
          inputWeb: { backgroundColor: '#fff', padding: 12, margin: 8 },
        }}
      />

      {selectedContact && (
        <View className="p-4 border-b border-gray-300">
          <Text className="text-lg font-bold text-[#3b302a] dark:text-[#d4bfa3]">
            Chat with {selectedContact.displayName || selectedContact.email}
          </Text>
        </View>
      )}

      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <ChatMessage message={item} isOwnMessage={item.sender_id === user.id} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
      />

      <MessageInput onSend={sendMessage} />
    </View>
  );
}
EOF
#endregion

#region CUES SCREEN
cat > "app/(tabs)/cues.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function CuesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Cues</Text>
    </View>
  );
}
EOF
#endregion

#region PROFILE SCREEN
cat > "app/(tabs)/profile.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { CustomButton } from '../../src/components/CustomButton';

export default function ProfileScreen() {
  const { setUser, user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error fetching profile:', error);
        } else if (data) {
          setProfile(data);
        }
      }
    }
    fetchProfile();
  }, [user]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      router.replace('/signIn');
    } else {
      console.error("Error signing out:", error);
    }
  };

  return (
    <View className="flex-1 bg-steampunk-light p-4 justify-between">
      <View>
        {profile ? (
          <View className="mb-6 space-y-3">
            <View>
              <Text className="text-sm text-[#3b302a] dark:text-[#d4bfa3]">Display Name:</Text>
              <Text className="text-lg text-[#3b302a] dark:text-[#d4bfa3]">
                {profile.displayName || 'N/A'}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-[#3b302a] dark:text-[#d4bfa3]">Email:</Text>
              <Text className="text-lg text-[#3b302a] dark:text-[#d4bfa3]">
                {profile.email}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-[#3b302a] dark:text-[#d4bfa3]">Bio:</Text>
              <Text className="text-lg text-[#3b302a] dark:text-[#d4bfa3]">
                {profile.bio || 'No bio available.'}
              </Text>
            </View>
          </View>
        ) : (
          <Text className="text-base text-[#3b302a] dark:text-[#d4bfa3] mb-6">Loading profile...</Text>
        )}
      </View>

      <View className="space-y-4">
        <Text onPress={() => router.push('/profileEdit')} className="link text-center text-sm">
          Edit Profile
        </Text>
        <CustomButton
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          onPress={toggleTheme}
        />
        <CustomButton title="Log Out" onPress={handleLogout} />
      </View>
    </View>
  );
}
EOF
#endregion

#region Profile Edit Screen
cat > "app/profileEdit.tsx" << 'EOF'
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/store/useAuthStore';
import { CustomButton } from '../src/components/CustomButton';

export default function ProfileEditScreen() {
  const { user } = useAuthStore();
  const [avatar, setAvatar] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error fetching profile:', error);
        } else if (data) {
          setAvatar(data.avatar || '');
          setDisplayName(data.displayName || '');
          setBio(data.bio || '');
        }
      }
    }
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    setError('');
    const updates = {
      avatar,
      displayName,
      bio,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates }, { returning: 'minimal' });
    if (error) {
      setError(error.message);
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-1 p-4 bg-steampunk-light">
      <Text className="text-2xl mb-4 text-[#3b302a] dark:text-[#d4bfa3]">Edit Profile</Text>
      {error && <Text className="text-red-500 mb-3">{error}</Text>}
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-1">Avatar URL:</Text>
      <TextInput
        value={avatar}
        onChangeText={setAvatar}
        className="border border-gray-300 p-2 rounded mb-3 input-shadow"
      />
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-1">Display Name:</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        className="border border-gray-300 p-2 rounded mb-3 input-shadow"
      />
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-1">Bio:</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        className="border border-gray-300 p-2 rounded mb-3 input-shadow"
      />
      <CustomButton title="Save" onPress={handleSave} />
      <CustomButton title="Cancel" onPress={() => router.back()} />
    </View>
  );
}
EOF
#endregion

#region ChatMessage Component
cat > "src/components/ChatMessage.tsx" << 'EOF'
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ChatMessageProps {
  message: any;
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  return (
    <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
      <Text style={styles.messageContent}>
        {message.content}{message.updated_at ? ' (edited)' : ''}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(message.created_at).toLocaleTimeString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#c0a080',
    borderColor: '#3b302a',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0d0c0',
    borderColor: '#5a4a42',
  },
  messageContent: {
    fontSize: 16,
    color: '#3b302a',
  },
  timestamp: {
    fontSize: 10,
    color: '#5a4a42',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
});
EOF
#endregion

#region MessageInput Component
cat > "src/components/MessageInput.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageInputProps {
  onSend: (text: string) => void;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message..."
        placeholderTextColor="#5a4a42"
        multiline
      />
      <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
        <Ionicons name="send" size={24} color="#3b302a" />
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0e6d2',
    borderTopWidth: 1,
    borderColor: '#3b302a'
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b302a',
    marginRight: 8,
    color: '#3b302a'
  },
  sendButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#c0a080'
  },
};
EOF
#endregion

#region Supabase Client
cat > "src/lib/supabase.ts" << 'EOF'
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
}

const detectSessionInUrl = Platform.OS === 'web';
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: detectSessionInUrl,
  },
});
EOF
#endregion

#region Zustand Auth Store
cat > "src/store/useAuthStore.ts" << 'EOF'
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type AuthState = {
  user: any;
  setUser: (user: any) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isLoading: true,
  setLoading: (loading) => set({ isLoading: loading }),
}));

(async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session:', error);
  }
  useAuthStore.setState({
    user: session?.user || null,
    isLoading: false,
  });
})();

supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({
    user: session?.user || null,
    isLoading: false,
  });
});
EOF
#endregion

#region Final Setup
echo "✅ Project setup complete!"
echo "Next steps:"
echo "1. Update your .env with EXPO_PUBLIC_SUPABASE_URL/ANON_KEY from the same project you used for Script 1."
echo "2. Run the script below (Script 3) in your Supabase SQL editor to seed sample data."
echo "3. Then do 'npx expo start --clear' in this folder."
echo "4. Sign in as e.g. 'testuser@example.com' (with your seeded password) or create a new account."
echo "5. Check the Home screen for dummy posts from the 'contents' table."
#endregion
```

---

## Script 3: **SQL** – Seed Sample Data (Insert Admin, Testers, and Dummy Post)

Finally, run this **after** Script 1. It inserts:

- An admin user (`admin@yourdomain.com`)  
- Three testers (`jon@example.com`, `jane@example.com`, `testuser@example.com`)  
- A conversation between each tester and the admin  
- A multi-line sample post from `testuser@example.com` in `public.contents`  

```sql
DO $$
DECLARE
    admin_email text := 'admin@yourdomain.com';  -- Replace with your admin email
    admin_id uuid;
    tester record;
    tester_id uuid;
    conv_id uuid;
    sample_content_user_id uuid;
    new_content_id uuid;
BEGIN
    -- Retrieve the admin user's ID from auth.users
    SELECT id INTO admin_id
    FROM auth.users
    WHERE email = admin_email;
    
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin user not found with email: %', admin_email;
    END IF;
    
    -- Ensure the admin has a profile
    INSERT INTO public.profiles (id, avatar, "displayName", bio, created_at, updated_at)
    VALUES (admin_id, NULL, admin_email, '', now(), now())
    ON CONFLICT (id) DO NOTHING;
    
    -- Loop over sample testers
    FOR tester IN
      SELECT * FROM (VALUES
         ('jon@example.com', 'Jon Doe', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8h6zLCQ1MPv6Uo/Mz7KblIwd4ZpP4W'),
         ('jane@example.com', 'Jane Doe', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8h6zLCQ1MPv6Uo/Mz7KblIwd4ZpP4W'),
         ('testuser@example.com', 'Test User', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8h6zLCQ1MPv6Uo/Mz7KblIwd4ZpP4W')
      ) AS t(email, displayName, encrypted_password)
    LOOP
        -- Check if the tester exists in auth.users
        SELECT id INTO tester_id
        FROM auth.users
        WHERE email = tester.email;
        
        IF tester_id IS NULL THEN
            INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
            VALUES (gen_random_uuid(), 'authenticated', 'authenticated', tester.email, tester.encrypted_password, now(), now())
            RETURNING id INTO tester_id;
        END IF;
        
        -- Ensure the tester has a profile
        INSERT INTO public.profiles (id, avatar, "displayName", bio, created_at, updated_at)
        VALUES (tester_id, NULL, tester.displayName, '', now(), now())
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert a top-level post (parent_id = NULL)
        INSERT INTO public.contents (user_id, content, parent_id, created_at, updated_at)
        VALUES (tester_id, 'This is a sample post from ' || tester.displayName, NULL, now(), now())
        RETURNING id INTO new_content_id;
        
        -- Check for an existing conversation between admin and this tester
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
        
        -- Insert an initial message from tester to admin
        INSERT INTO public.messages (conversation_id, sender_id, content, created_at, updated_at)
        VALUES (conv_id, tester_id, 'Hello Admin, this is ' || tester.displayName || '!', now(), now());
        
        -- Seed a friend request from tester to admin
        INSERT INTO public.friend_requests (sender_id, receiver_id, status, created_at, updated_at)
        VALUES (tester_id, admin_id, 'pending', now(), now())
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Insert a sample top-level post from the test user
    SELECT id INTO sample_content_user_id 
    FROM auth.users 
    WHERE email = 'testuser@example.com';
    
    IF sample_content_user_id IS NULL THEN
        RAISE EXCEPTION 'Test user not found';
    END IF;
    
    INSERT INTO public.profiles (id, avatar, "displayName", bio, created_at, updated_at)
    VALUES (sample_content_user_id, NULL, 'Test User', '', now(), now())
    ON CONFLICT (id) DO NOTHING;
    
    -- Multi-line post from 'Test User'
    INSERT INTO public.contents (user_id, content, parent_id, created_at, updated_at)
    VALUES (
        sample_content_user_id,
        $BODY$
Hey there! Meet **ScriptHammer**—a handy bash script that sets up a complete Expo app with everything you need right out of the box.

### What It Does
- **Loads Your Environment:** It checks your `.env` file for essential keys like your app name, Supabase URL & anon key, and Google Maps API key.
- **Creates an Expo App:** Runs `npx create-expo-app` (with TypeScript) and cleans up unneeded files.
- **Installs Dependencies:** Adds libraries for state management (Zustand), styling (Tailwind, NativeWind), auth, maps, forms, and realtime messaging with Supabase.
- **Sets Up Project Structure:** Folders and starter files for authentication, routing, theming (light/dark mode), posts, and chats.
- **Local CLI & Configs:** Installs the local Expo CLI, plus config for Metro, Babel, and Tailwind.
- **Why You'll Love It:** Saves time, uses a modern tech stack, and is easily customizable.
$BODY$,
        NULL,
        now(),
        now()
    );
END $$;
```

---

### Usage

1. **Script 1**: Run in Supabase SQL editor (or as a migration). It creates the new `contents` table, `content_reactions`, merges your schema, sets RLS, and publishes for realtime.  
2. **Script 2**: Run locally in your shell to scaffold the new Expo front-end with references to the `contents` table for top-level posts. Adjust `.env` to your actual `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.  
3. **Script 3**: Run in Supabase SQL editor to seed sample data (admin, testers, a multi-line post from `testuser@example.com`).  

**Afterwards**:  
- Sign in as `testuser@example.com` (or `jon@example.com`, etc.) using the password you see in the script (`$2b$10...` is a bcrypt hash for `some default password` if that’s how you set it).  
- Check the Home screen: you should see your dummy posts from the `contents` table (with `parent_id = null`).  
- If you still see no content, open dev tools and verify the query results, check RLS policy usage, or confirm your `.env` is pointing to the correct Supabase project.  

With these **3 scripts**—**SQL, Bash, SQL**—your top-level posts should appear on the home page, and you can create/edit new posts in the unified `contents` table. Enjoy!
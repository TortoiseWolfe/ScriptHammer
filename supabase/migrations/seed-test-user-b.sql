-- Seed Test User B (Tertiary) for E2E Messaging Tests (Feature 024)
-- Creates: test-user-b@example.com / TestPassword456!
-- Username: testuser-b
-- Email is already confirmed (bypasses verification requirement)
-- Safe to run multiple times (deletes and recreates user)

-- 1. Delete existing user if present (cascade deletes identities and profile)
DELETE FROM auth.users WHERE email = 'test-user-b@example.com';

-- 2. Create the user in auth.users with confirmed email
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'test-user-b@example.com',
  crypt('TestPassword456!', gen_salt('bf')),  -- Hashed password using bcrypt
  now(),  -- Email already confirmed
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"testuser-b"}',  -- Set username in user metadata
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
);

-- 3. Create identity record (required for Supabase Auth)
INSERT INTO auth.identities (
  provider_id,
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'test-user-b@example.com';

-- 4. Create user profile (required for messaging tests)
INSERT INTO user_profiles (
  id,
  username,
  display_name,
  created_at,
  updated_at
)
SELECT
  id,
  'testuser-b',
  'Test User B',
  now(),
  now()
FROM auth.users
WHERE email = 'test-user-b@example.com';

-- Verify the user and profile were created
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  p.username,
  p.display_name,
  u.created_at
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE u.email = 'test-user-b@example.com';

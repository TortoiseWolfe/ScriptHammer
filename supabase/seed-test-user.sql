-- Seed Test User for Contract Tests
-- Creates: test@example.com / TestPassword123!
-- Email is already confirmed (bypasses verification requirement)
-- Safe to run multiple times (deletes and recreates user)

-- 1. Delete existing user if present (cascade deletes identities)
DELETE FROM auth.users WHERE email = 'test@example.com';

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
  'test@example.com',
  crypt('TestPassword123!', gen_salt('bf')),  -- Hashed password using bcrypt
  now(),  -- Email already confirmed
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
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
WHERE email = 'test@example.com';

-- Verify the user was created
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'test@example.com';

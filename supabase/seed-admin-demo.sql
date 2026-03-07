-- ============================================================================
-- ADMIN DASHBOARD DEMO DATA
-- Populates all tables the admin dashboard reads so every stat card,
-- chart, and table has realistic non-zero values.
-- Safe to re-run: uses ON CONFLICT DO NOTHING and fixed UUIDs.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. USERS (8 demo users + existing admin stays untouched)
-- ============================================================================
-- Fixed UUIDs so FKs are deterministic. Ordered for canonical_ordering
-- constraint on conversations (participant_1_id < participant_2_id).

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  -- User 1: active, signed in yesterday
  ('11111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000000',
   'alice@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '45 days', now() - interval '45 days', now(),
   now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- User 2: active, signed in today
  ('11111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000000',
   'bob@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '30 days', now() - interval '30 days', now(),
   now() - interval '2 hours',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- User 3: active, signed in 3 days ago
  ('11111111-1111-1111-1111-111111111103', '00000000-0000-0000-0000-000000000000',
   'carol@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '60 days', now() - interval '60 days', now(),
   now() - interval '3 days',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- User 4: idle, signed in 15 days ago
  ('11111111-1111-1111-1111-111111111104', '00000000-0000-0000-0000-000000000000',
   'dave@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '50 days', now() - interval '50 days', now(),
   now() - interval '15 days',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- User 5: idle, signed in 20 days ago
  ('11111111-1111-1111-1111-111111111105', '00000000-0000-0000-0000-000000000000',
   'eve@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '55 days', now() - interval '55 days', now(),
   now() - interval '20 days',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- User 6: dormant, signed in 40 days ago
  ('11111111-1111-1111-1111-111111111106', '00000000-0000-0000-0000-000000000000',
   'frank@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '58 days', now() - interval '58 days', now(),
   now() - interval '40 days',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- User 7: dormant, never signed in
  ('11111111-1111-1111-1111-111111111107', '00000000-0000-0000-0000-000000000000',
   'grace@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '40 days', now() - interval '40 days', now(),
   NULL,
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- User 8: active, signed in 5 days ago
  ('11111111-1111-1111-1111-111111111108', '00000000-0000-0000-0000-000000000000',
   'hank@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '20 days', now() - interval '20 days', now(),
   now() - interval '5 days',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Identity records (required for Supabase Auth login)
INSERT INTO auth.identities (provider_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.id, gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.last_sign_in_at, u.created_at, u.updated_at
FROM auth.users u
WHERE u.email LIKE '%@demo.test'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- User profiles
INSERT INTO user_profiles (id, username, display_name, welcome_message_sent, is_admin, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'alice',   'Alice Johnson',  true,  false, now() - interval '45 days', now()),
  ('11111111-1111-1111-1111-111111111102', 'bob',     'Bob Smith',      true,  false, now() - interval '30 days', now()),
  ('11111111-1111-1111-1111-111111111103', 'carol',   'Carol Williams', true,  false, now() - interval '60 days', now()),
  ('11111111-1111-1111-1111-111111111104', 'dave',    'Dave Brown',     true,  false, now() - interval '50 days', now()),
  ('11111111-1111-1111-1111-111111111105', 'eve',     'Eve Davis',      false, false, now() - interval '55 days', now()),
  ('11111111-1111-1111-1111-111111111106', 'frank',   'Frank Wilson',   false, false, now() - interval '58 days', now()),
  ('11111111-1111-1111-1111-111111111107', 'grace',   'Grace Lee',      false, false, now() - interval '40 days', now()),
  ('11111111-1111-1111-1111-111111111108', 'hank',    'Hank Taylor',    true,  false, now() - interval '20 days', now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. PAYMENT INTENTS + RESULTS (~30 transactions over 14 days)
-- ============================================================================

-- Payment intents (5 intents, each with multiple results)
INSERT INTO payment_intents (id, template_user_id, amount, currency, type, customer_email, created_at)
VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 2500, 'usd', 'one_time', 'alice@demo.test', now() - interval '13 days'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 4999, 'usd', 'one_time', 'bob@demo.test',   now() - interval '10 days'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', 1500, 'usd', 'recurring', 'carol@demo.test', now() - interval '8 days'),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111104', 7500, 'eur', 'one_time', 'dave@demo.test',  now() - interval '5 days'),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111105', 3000, 'usd', 'one_time', 'eve@demo.test',   now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Payment results spread over 14 days with mix of statuses and providers
INSERT INTO payment_results (id, intent_id, provider, transaction_id, status, charged_amount, charged_currency, webhook_verified, created_at)
VALUES
  -- Day -13: 2 stripe succeeded
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'stripe',  'txn_stripe_001', 'succeeded', 2500, 'usd', true, now() - interval '13 days'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', 'stripe',  'txn_stripe_002', 'succeeded', 2500, 'usd', true, now() - interval '13 days' + interval '2 hours'),
  -- Day -12: 1 paypal succeeded, 1 stripe failed
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', 'paypal',  'txn_paypal_001', 'succeeded', 2500, 'usd', true, now() - interval '12 days'),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222201', 'stripe',  'txn_stripe_003', 'failed',    NULL, NULL,  false, now() - interval '12 days' + interval '3 hours'),
  -- Day -10: 3 succeeded (stripe + paypal)
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222202', 'stripe',  'txn_stripe_004', 'succeeded', 4999, 'usd', true, now() - interval '10 days'),
  ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222202', 'paypal',  'txn_paypal_002', 'succeeded', 4999, 'usd', true, now() - interval '10 days' + interval '1 hour'),
  ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222202', 'stripe',  'txn_stripe_005', 'succeeded', 4999, 'usd', true, now() - interval '10 days' + interval '4 hours'),
  -- Day -8: 2 succeeded, 1 refunded
  ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222203', 'stripe',  'txn_stripe_006', 'succeeded', 1500, 'usd', true, now() - interval '8 days'),
  ('33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222203', 'paypal',  'txn_paypal_003', 'succeeded', 1500, 'usd', true, now() - interval '8 days' + interval '2 hours'),
  ('33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222203', 'stripe',  'txn_stripe_007', 'refunded',  1500, 'usd', true, now() - interval '8 days' + interval '5 hours'),
  -- Day -7: 2 succeeded
  ('33333333-3333-3333-3333-333333333311', '22222222-2222-2222-2222-222222222203', 'stripe',  'txn_stripe_008', 'succeeded', 1500, 'usd', true, now() - interval '7 days'),
  ('33333333-3333-3333-3333-333333333312', '22222222-2222-2222-2222-222222222203', 'paypal',  'txn_paypal_004', 'succeeded', 1500, 'usd', true, now() - interval '7 days' + interval '3 hours'),
  -- Day -6: 1 failed, 1 succeeded
  ('33333333-3333-3333-3333-333333333313', '22222222-2222-2222-2222-222222222204', 'paypal',  'txn_paypal_005', 'failed',    NULL, NULL,  false, now() - interval '6 days'),
  ('33333333-3333-3333-3333-333333333314', '22222222-2222-2222-2222-222222222204', 'stripe',  'txn_stripe_009', 'succeeded', 7500, 'eur', true, now() - interval '6 days' + interval '1 hour'),
  -- Day -5: 3 succeeded
  ('33333333-3333-3333-3333-333333333315', '22222222-2222-2222-2222-222222222204', 'stripe',  'txn_stripe_010', 'succeeded', 7500, 'eur', true, now() - interval '5 days'),
  ('33333333-3333-3333-3333-333333333316', '22222222-2222-2222-2222-222222222204', 'paypal',  'txn_paypal_006', 'succeeded', 7500, 'eur', true, now() - interval '5 days' + interval '2 hours'),
  ('33333333-3333-3333-3333-333333333317', '22222222-2222-2222-2222-222222222204', 'stripe',  'txn_stripe_011', 'succeeded', 7500, 'eur', true, now() - interval '5 days' + interval '5 hours'),
  -- Day -4: 1 refunded, 2 succeeded
  ('33333333-3333-3333-3333-333333333318', '22222222-2222-2222-2222-222222222204', 'stripe',  'txn_stripe_012', 'refunded',  7500, 'eur', true, now() - interval '4 days'),
  ('33333333-3333-3333-3333-333333333319', '22222222-2222-2222-2222-222222222205', 'paypal',  'txn_paypal_007', 'succeeded', 3000, 'usd', true, now() - interval '4 days' + interval '1 hour'),
  ('33333333-3333-3333-3333-333333333320', '22222222-2222-2222-2222-222222222205', 'stripe',  'txn_stripe_013', 'succeeded', 3000, 'usd', true, now() - interval '4 days' + interval '4 hours'),
  -- Day -3: 2 succeeded, 1 failed
  ('33333333-3333-3333-3333-333333333321', '22222222-2222-2222-2222-222222222205', 'stripe',  'txn_stripe_014', 'succeeded', 3000, 'usd', true, now() - interval '3 days'),
  ('33333333-3333-3333-3333-333333333322', '22222222-2222-2222-2222-222222222205', 'paypal',  'txn_paypal_008', 'succeeded', 3000, 'usd', true, now() - interval '3 days' + interval '2 hours'),
  ('33333333-3333-3333-3333-333333333323', '22222222-2222-2222-2222-222222222205', 'stripe',  'txn_stripe_015', 'failed',    NULL, NULL,  false, now() - interval '3 days' + interval '6 hours'),
  -- Day -2: 2 succeeded
  ('33333333-3333-3333-3333-333333333324', '22222222-2222-2222-2222-222222222205', 'stripe',  'txn_stripe_016', 'succeeded', 3000, 'usd', true, now() - interval '2 days'),
  ('33333333-3333-3333-3333-333333333325', '22222222-2222-2222-2222-222222222205', 'paypal',  'txn_paypal_009', 'succeeded', 3000, 'usd', true, now() - interval '2 days' + interval '3 hours'),
  -- Day -1: 3 succeeded, 1 pending
  ('33333333-3333-3333-3333-333333333326', '22222222-2222-2222-2222-222222222201', 'stripe',  'txn_stripe_017', 'succeeded', 2500, 'usd', true, now() - interval '1 day'),
  ('33333333-3333-3333-3333-333333333327', '22222222-2222-2222-2222-222222222201', 'paypal',  'txn_paypal_010', 'succeeded', 2500, 'usd', true, now() - interval '1 day' + interval '1 hour'),
  ('33333333-3333-3333-3333-333333333328', '22222222-2222-2222-2222-222222222201', 'stripe',  'txn_stripe_018', 'succeeded', 2500, 'usd', true, now() - interval '1 day' + interval '4 hours'),
  ('33333333-3333-3333-3333-333333333329', '22222222-2222-2222-2222-222222222202', 'stripe',  'txn_stripe_019', 'pending',   4999, 'usd', false, now() - interval '6 hours')
ON CONFLICT (id) DO NOTHING;

-- Subscriptions (1 active, 1 canceled)
INSERT INTO subscriptions (id, template_user_id, provider, provider_subscription_id, customer_email, plan_amount, plan_interval, status, created_at)
VALUES
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101', 'stripe', 'sub_stripe_001', 'alice@demo.test', 1500, 'month', 'active',   now() - interval '30 days'),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111104', 'paypal', 'sub_paypal_001', 'dave@demo.test',  2900, 'year',  'canceled', now() - interval '45 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. AUTH AUDIT LOGS (~55 events over 14 days, including a burst)
-- ============================================================================

INSERT INTO auth_audit_logs (id, user_id, event_type, success, ip_address, created_at)
VALUES
  -- Signups (staggered over 30 days for signups_this_month)
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111101', 'sign_up', true, '10.0.0.1', now() - interval '45 days'),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111102', 'sign_up', true, '10.0.0.2', now() - interval '30 days'),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111103', 'sign_up', true, '10.0.0.3', now() - interval '25 days'),
  ('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111108', 'sign_up', true, '10.0.0.8', now() - interval '20 days'),
  ('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111107', 'sign_up', true, '10.0.0.7', now() - interval '15 days'),

  -- Successful logins spread over the week (for logins_today and sparkline)
  ('55555555-5555-5555-5555-555555555510', '11111111-1111-1111-1111-111111111101', 'sign_in_success', true, '10.0.0.1', now() - interval '6 days'),
  ('55555555-5555-5555-5555-555555555511', '11111111-1111-1111-1111-111111111102', 'sign_in_success', true, '10.0.0.2', now() - interval '6 days' + interval '1 hour'),
  ('55555555-5555-5555-5555-555555555512', '11111111-1111-1111-1111-111111111103', 'sign_in_success', true, '10.0.0.3', now() - interval '5 days'),
  ('55555555-5555-5555-5555-555555555513', '11111111-1111-1111-1111-111111111101', 'sign_in_success', true, '10.0.0.1', now() - interval '5 days' + interval '3 hours'),
  ('55555555-5555-5555-5555-555555555514', '11111111-1111-1111-1111-111111111104', 'sign_in_success', true, '10.0.0.4', now() - interval '4 days'),
  ('55555555-5555-5555-5555-555555555515', '11111111-1111-1111-1111-111111111102', 'sign_in_success', true, '10.0.0.2', now() - interval '4 days' + interval '2 hours'),
  ('55555555-5555-5555-5555-555555555516', '11111111-1111-1111-1111-111111111105', 'sign_in_success', true, '10.0.0.5', now() - interval '3 days'),
  ('55555555-5555-5555-5555-555555555517', '11111111-1111-1111-1111-111111111101', 'sign_in_success', true, '10.0.0.1', now() - interval '3 days' + interval '4 hours'),
  ('55555555-5555-5555-5555-555555555518', '11111111-1111-1111-1111-111111111103', 'sign_in_success', true, '10.0.0.3', now() - interval '2 days'),
  ('55555555-5555-5555-5555-555555555519', '11111111-1111-1111-1111-111111111102', 'sign_in_success', true, '10.0.0.2', now() - interval '2 days' + interval '1 hour'),
  ('55555555-5555-5555-5555-555555555520', '11111111-1111-1111-1111-111111111108', 'sign_in_success', true, '10.0.0.8', now() - interval '1 day'),
  ('55555555-5555-5555-5555-555555555521', '11111111-1111-1111-1111-111111111101', 'sign_in_success', true, '10.0.0.1', now() - interval '1 day' + interval '2 hours'),
  -- Today logins
  ('55555555-5555-5555-5555-555555555522', '11111111-1111-1111-1111-111111111101', 'sign_in_success', true, '10.0.0.1', now() - interval '3 hours'),
  ('55555555-5555-5555-5555-555555555523', '11111111-1111-1111-1111-111111111102', 'sign_in_success', true, '10.0.0.2', now() - interval '2 hours'),
  ('55555555-5555-5555-5555-555555555524', '11111111-1111-1111-1111-111111111103', 'sign_in_success', true, '10.0.0.3', now() - interval '1 hour'),

  -- Failed logins spread over the week
  ('55555555-5555-5555-5555-555555555530', '11111111-1111-1111-1111-111111111104', 'sign_in_failed', false, '10.0.0.4', now() - interval '6 days'),
  ('55555555-5555-5555-5555-555555555531', '11111111-1111-1111-1111-111111111105', 'sign_in_failed', false, '10.0.0.5', now() - interval '5 days'),
  ('55555555-5555-5555-5555-555555555532', '11111111-1111-1111-1111-111111111104', 'sign_in_failed', false, '10.0.0.4', now() - interval '4 days'),
  ('55555555-5555-5555-5555-555555555533', '11111111-1111-1111-1111-111111111106', 'sign_in_failed', false, '10.0.0.6', now() - interval '3 days'),
  ('55555555-5555-5555-5555-555555555534', '11111111-1111-1111-1111-111111111105', 'sign_in_failed', false, '10.0.0.5', now() - interval '2 days'),
  ('55555555-5555-5555-5555-555555555535', '11111111-1111-1111-1111-111111111104', 'sign_in_failed', false, '10.0.0.4', now() - interval '1 day'),

  -- BURST: 7 rapid failed logins from same IP within 10 minutes (triggers burst detection)
  ('55555555-5555-5555-5555-555555555540', '11111111-1111-1111-1111-111111111101', 'sign_in_failed', false, '192.168.99.99', now() - interval '2 days' + interval '14 hours'),
  ('55555555-5555-5555-5555-555555555541', '11111111-1111-1111-1111-111111111102', 'sign_in_failed', false, '192.168.99.99', now() - interval '2 days' + interval '14 hours' + interval '30 seconds'),
  ('55555555-5555-5555-5555-555555555542', '11111111-1111-1111-1111-111111111103', 'sign_in_failed', false, '192.168.99.99', now() - interval '2 days' + interval '14 hours' + interval '1 minute'),
  ('55555555-5555-5555-5555-555555555543', '11111111-1111-1111-1111-111111111104', 'sign_in_failed', false, '192.168.99.99', now() - interval '2 days' + interval '14 hours' + interval '2 minutes'),
  ('55555555-5555-5555-5555-555555555544', '11111111-1111-1111-1111-111111111105', 'sign_in_failed', false, '192.168.99.99', now() - interval '2 days' + interval '14 hours' + interval '3 minutes'),
  ('55555555-5555-5555-5555-555555555545', '11111111-1111-1111-1111-111111111106', 'sign_in_failed', false, '192.168.99.99', now() - interval '2 days' + interval '14 hours' + interval '4 minutes'),
  ('55555555-5555-5555-5555-555555555546', '11111111-1111-1111-1111-111111111101', 'sign_in_failed', false, '192.168.99.99', now() - interval '2 days' + interval '14 hours' + interval '5 minutes'),

  -- More scattered events for variety
  ('55555555-5555-5555-5555-555555555550', '11111111-1111-1111-1111-111111111101', 'sign_in_success', true, '10.0.0.1', now() - interval '10 days'),
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111102', 'sign_in_success', true, '10.0.0.2', now() - interval '9 days'),
  ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111103', 'sign_in_success', true, '10.0.0.3', now() - interval '8 days'),
  ('55555555-5555-5555-5555-555555555553', '11111111-1111-1111-1111-111111111108', 'sign_in_success', true, '10.0.0.8', now() - interval '7 days'),
  ('55555555-5555-5555-5555-555555555554', '11111111-1111-1111-1111-111111111101', 'sign_in_failed',  false, '10.0.0.99', now() - interval '11 days'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111102', 'sign_in_failed',  false, '10.0.0.99', now() - interval '9 days')
ON CONFLICT (id) DO NOTHING;

-- Rate limit entry (shows as rate_limited_users in audit stats)
INSERT INTO rate_limit_attempts (id, identifier, attempt_type, ip_address, attempt_count, locked_until, window_start, created_at)
VALUES
  ('66666666-6666-6666-6666-666666666601', 'eve@demo.test', 'sign_in', '10.0.0.5', 6, now() - interval '10 minutes', now() - interval '30 minutes', now() - interval '30 minutes')
ON CONFLICT (identifier, attempt_type) DO NOTHING;

-- ============================================================================
-- 4. USER CONNECTIONS (10 connections, mixed statuses)
-- ============================================================================

INSERT INTO user_connections (id, requester_id, addressee_id, status, created_at)
VALUES
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102', 'accepted', now() - interval '40 days'),
  ('77777777-7777-7777-7777-777777777702', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111103', 'accepted', now() - interval '38 days'),
  ('77777777-7777-7777-7777-777777777703', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111103', 'accepted', now() - interval '35 days'),
  ('77777777-7777-7777-7777-777777777704', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111104', 'accepted', now() - interval '30 days'),
  ('77777777-7777-7777-7777-777777777705', '11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111105', 'accepted', now() - interval '25 days'),
  ('77777777-7777-7777-7777-777777777706', '11111111-1111-1111-1111-111111111104', '11111111-1111-1111-1111-111111111106', 'pending',  now() - interval '5 days'),
  ('77777777-7777-7777-7777-777777777707', '11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111107', 'pending',  now() - interval '3 days'),
  ('77777777-7777-7777-7777-777777777708', '11111111-1111-1111-1111-111111111106', '11111111-1111-1111-1111-111111111108', 'pending',  now() - interval '1 day'),
  ('77777777-7777-7777-7777-777777777709', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111106', 'blocked',  now() - interval '20 days'),
  ('77777777-7777-7777-7777-777777777710', '11111111-1111-1111-1111-111111111104', '11111111-1111-1111-1111-111111111107', 'declined', now() - interval '10 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. CONVERSATIONS + MESSAGES
-- ============================================================================
-- conversations has canonical_ordering: participant_1_id < participant_2_id
-- Our UUIDs ...01 < ...02 < ...03 etc. so order naturally.

INSERT INTO conversations (id, participant_1_id, participant_2_id, is_group, last_message_at, created_at)
VALUES
  -- 4 direct conversations
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102', false, now() - interval '1 day',  now() - interval '12 days'),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111103', false, now() - interval '2 days', now() - interval '10 days'),
  ('88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111103', false, now() - interval '3 days', now() - interval '8 days'),
  ('88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111104', false, now() - interval '5 days', now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

-- Messages: ~40 spread across conversations over 12 days
-- sequence_number is per-conversation, auto-incrementing
INSERT INTO messages (id, conversation_id, sender_id, encrypted_content, initialization_vector, sequence_number, deleted, created_at)
VALUES
  -- Conv 1 (alice <-> bob): 12 messages
  ('99999999-9999-9999-9999-999999999901', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 1, false, now() - interval '12 days'),
  ('99999999-9999-9999-9999-999999999902', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 2, false, now() - interval '12 days' + interval '10 minutes'),
  ('99999999-9999-9999-9999-999999999903', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 3, false, now() - interval '10 days'),
  ('99999999-9999-9999-9999-999999999904', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 4, false, now() - interval '8 days'),
  ('99999999-9999-9999-9999-999999999905', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 5, false, now() - interval '6 days'),
  ('99999999-9999-9999-9999-999999999906', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 6, false, now() - interval '5 days'),
  ('99999999-9999-9999-9999-999999999907', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 7, false, now() - interval '4 days'),
  ('99999999-9999-9999-9999-999999999908', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 8, false, now() - interval '3 days'),
  ('99999999-9999-9999-9999-999999999909', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 9, false, now() - interval '2 days'),
  ('99999999-9999-9999-9999-999999999910', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 10, false, now() - interval '1 day'),
  ('99999999-9999-9999-9999-999999999911', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 11, false, now() - interval '1 day' + interval '2 hours'),
  ('99999999-9999-9999-9999-999999999912', '88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 12, false, now() - interval '12 hours'),

  -- Conv 2 (alice <-> carol): 10 messages
  ('99999999-9999-9999-9999-999999999913', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 1, false, now() - interval '10 days'),
  ('99999999-9999-9999-9999-999999999914', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 2, false, now() - interval '9 days'),
  ('99999999-9999-9999-9999-999999999915', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 3, false, now() - interval '7 days'),
  ('99999999-9999-9999-9999-999999999916', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 4, false, now() - interval '6 days'),
  ('99999999-9999-9999-9999-999999999917', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 5, false, now() - interval '5 days'),
  ('99999999-9999-9999-9999-999999999918', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 6, false, now() - interval '4 days'),
  ('99999999-9999-9999-9999-999999999919', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 7, false, now() - interval '3 days'),
  ('99999999-9999-9999-9999-999999999920', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 8, false, now() - interval '2 days'),
  ('99999999-9999-9999-9999-999999999921', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111101', 'enc_demo', 'iv_demo', 9, true,  now() - interval '2 days' + interval '1 hour'),
  ('99999999-9999-9999-9999-999999999922', '88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 10, false, now() - interval '2 days' + interval '3 hours'),

  -- Conv 3 (bob <-> carol): 10 messages
  ('99999999-9999-9999-9999-999999999923', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 1, false, now() - interval '8 days'),
  ('99999999-9999-9999-9999-999999999924', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 2, false, now() - interval '7 days'),
  ('99999999-9999-9999-9999-999999999925', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 3, false, now() - interval '6 days'),
  ('99999999-9999-9999-9999-999999999926', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 4, false, now() - interval '5 days'),
  ('99999999-9999-9999-9999-999999999927', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 5, false, now() - interval '4 days'),
  ('99999999-9999-9999-9999-999999999928', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 6, false, now() - interval '3 days'),
  ('99999999-9999-9999-9999-999999999929', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 7, false, now() - interval '3 days' + interval '2 hours'),
  ('99999999-9999-9999-9999-999999999930', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 8, false, now() - interval '3 days' + interval '4 hours'),
  ('99999999-9999-9999-9999-999999999931', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 9, false, now() - interval '3 days' + interval '6 hours'),
  ('99999999-9999-9999-9999-999999999932', '88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111103', 'enc_demo', 'iv_demo', 10, false, now() - interval '3 days' + interval '8 hours'),

  -- Conv 4 (bob <-> dave): 8 messages
  ('99999999-9999-9999-9999-999999999933', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 1, false, now() - interval '6 days'),
  ('99999999-9999-9999-9999-999999999934', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111104', 'enc_demo', 'iv_demo', 2, false, now() - interval '6 days' + interval '30 minutes'),
  ('99999999-9999-9999-9999-999999999935', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 3, false, now() - interval '5 days'),
  ('99999999-9999-9999-9999-999999999936', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111104', 'enc_demo', 'iv_demo', 4, false, now() - interval '5 days' + interval '1 hour'),
  ('99999999-9999-9999-9999-999999999937', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 5, false, now() - interval '5 days' + interval '3 hours'),
  ('99999999-9999-9999-9999-999999999938', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111104', 'enc_demo', 'iv_demo', 6, false, now() - interval '5 days' + interval '5 hours'),
  ('99999999-9999-9999-9999-999999999939', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111102', 'enc_demo', 'iv_demo', 7, false, now() - interval '5 days' + interval '7 hours'),
  ('99999999-9999-9999-9999-999999999940', '88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111104', 'enc_demo', 'iv_demo', 8, false, now() - interval '5 days' + interval '9 hours')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. SET ADMIN FLAG ON TEST USER (ensure app_metadata has is_admin)
-- ============================================================================
-- The admin RPCs check auth.jwt()->'app_metadata'->>'is_admin'. This is set
-- during login if user_profiles.is_admin is true. Ensure the existing test
-- user has it in raw_app_meta_data so the JWT includes it.

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'test@example.com'
  AND NOT (raw_app_meta_data ? 'is_admin');

COMMIT;

-- Verify counts
SELECT 'auth.users' AS tbl, count(*) FROM auth.users
UNION ALL SELECT 'user_profiles', count(*) FROM user_profiles
UNION ALL SELECT 'payment_intents', count(*) FROM payment_intents
UNION ALL SELECT 'payment_results', count(*) FROM payment_results
UNION ALL SELECT 'subscriptions', count(*) FROM subscriptions
UNION ALL SELECT 'auth_audit_logs', count(*) FROM auth_audit_logs
UNION ALL SELECT 'user_connections', count(*) FROM user_connections
UNION ALL SELECT 'conversations', count(*) FROM conversations
UNION ALL SELECT 'messages', count(*) FROM messages
ORDER BY tbl;

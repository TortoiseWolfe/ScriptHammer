#!/usr/bin/env ts-node
/**
 * Seed script for creating all test users
 * Creates:
 *   - Admin: admin@scripthammer.com (username: scripthammer) - for welcome messages
 *   - Primary: test@example.com (username: testuser) - runs E2E tests
 *   - Secondary: test-user-b@example.com (username: testuser-b) - multi-user tests
 *   - Tertiary: test-user-c@example.com (username: testuser-c) - group chat tests
 *
 * Passwords are read from environment variables:
 *   - TEST_USER_PRIMARY_PASSWORD (default: TestPassword123!)
 *   - TEST_USER_SECONDARY_PASSWORD (default: TestPassword456!)
 *   - TEST_USER_TERTIARY_PASSWORD (default: TestPassword789!)
 *
 * Usage: docker compose exec scripthammer pnpm exec tsx scripts/seed-test-users.ts
 * Environment: Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Feature: 003-feature-004-welcome (admin), 010-feature-010-group-chats (3 users)
 * - Admin user has ECDH P-256 public key for welcome message encryption
 * - Private key is discarded (not needed at runtime)
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { requireApprovedTarget } from './lib/supabase-target';

// #877: announce and gate the destination before this script writes anything.
requireApprovedTarget('seed-test-users');

// In-container admin client: prefer SUPABASE_ADMIN_URL (compose-internal Kong)
// for the local sandbox; falls back to the public URL for cloud/CI (#121).
const supabaseUrl =
  process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get passwords from env vars - REQUIRED, no fallbacks
const PRIMARY_PASSWORD = process.env.TEST_USER_PRIMARY_PASSWORD;
const SECONDARY_PASSWORD = process.env.TEST_USER_SECONDARY_PASSWORD;
const TERTIARY_PASSWORD = process.env.TEST_USER_TERTIARY_PASSWORD;

// Validate required env vars
if (!PRIMARY_PASSWORD || !SECONDARY_PASSWORD || !TERTIARY_PASSWORD) {
  console.error('❌ ERROR: Missing test user passwords in environment');
  console.error('Required environment variables:');
  if (!PRIMARY_PASSWORD) console.error('  - TEST_USER_PRIMARY_PASSWORD');
  if (!SECONDARY_PASSWORD) console.error('  - TEST_USER_SECONDARY_PASSWORD');
  if (!TERTIARY_PASSWORD) console.error('  - TEST_USER_TERTIARY_PASSWORD');
  console.error('\nAdd these to your .env file');
  process.exit(1);
}

/**
 * Admin user configuration (T004)
 * Fixed UUID for consistent welcome message sender
 */
const ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@scripthammer.com',
  username: 'scripthammer',
  displayName: 'ScriptHammer',
};

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: Missing Supabase credentials');
  console.error('Required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUser {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

// Emails are env-driven (like the passwords above) so the seeded users match
// what the E2E specs read via TEST_USER_*_EMAIL. Fall back to the historical
// @example.com defaults when the vars are unset, so nothing breaks for setups
// that relied on the old hardcoded addresses.
const TEST_USERS: TestUser[] = [
  {
    email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
    password: PRIMARY_PASSWORD,
    username: 'testuser',
    displayName: 'Test User',
  },
  {
    email: process.env.TEST_USER_SECONDARY_EMAIL || 'test-user-b@example.com',
    password: SECONDARY_PASSWORD,
    username: 'testuser-b',
    displayName: 'Test User B',
  },
  {
    email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-c@example.com',
    password: TERTIARY_PASSWORD,
    username: 'testuser-c',
    displayName: 'Test User C',
  },
];

/**
 * Setup admin user with ECDH P-256 public key (T005)
 *
 * Creates:
 * 1. Auth user with fixed UUID
 * 2. User profile
 * 3. ECDH P-256 keypair (public key stored, private key discarded)
 *
 * @returns true if setup successful
 */
async function setupAdminUser(): Promise<boolean> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('🔑 Setting up Admin User for Welcome Messages');
  console.log(`${'═'.repeat(60)}`);

  try {
    // Step 1: Check if admin auth user already exists
    console.log('  🔍 Checking for existing admin user...');
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = authUsers?.users?.find(
      (u) => u.id === ADMIN_USER.id || u.email === ADMIN_USER.email
    );

    let adminUserId = ADMIN_USER.id;

    if (existingAdmin) {
      console.log(`  ℹ️  Admin user already exists (ID: ${existingAdmin.id})`);
      adminUserId = existingAdmin.id;
      // #240: user_profiles.is_admin (set below) is the single source of truth;
      // custom_access_token_hook derives the JWT claim from it at token mint.
      // We still pre-seed the claim here so seeded admins work on projects where
      // the hook hasn't been registered yet (out-of-band Auth config step) — the
      // hook harmlessly overwrites it on the next token mint. Safe to re-run.
      await supabase.auth.admin.updateUserById(existingAdmin.id, {
        app_metadata: { is_admin: true },
      });
    } else {
      // Create admin auth user with fixed UUID
      console.log('  🔐 Creating admin auth user...');
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: ADMIN_USER.email,
          password: 'AdminPassword123!', // Not used - no login needed
          email_confirm: true,
          user_metadata: { username: ADMIN_USER.username },
          // #240: pre-seed the claim for pre-hook projects (see note above).
          // The authority is the user_profiles.is_admin column set in Step 2;
          // custom_access_token_hook re-derives this claim from it at mint time.
          app_metadata: { is_admin: true },
        });

      if (authError) {
        // If email exists but different ID, we have a problem
        if (authError.code === 'email_exists') {
          console.log(
            '  ⚠️  Email exists with different ID, using existing...'
          );
          const existing = authUsers?.users?.find(
            (u) => u.email === ADMIN_USER.email
          );
          if (existing) {
            adminUserId = existing.id;
            await supabase.auth.admin.updateUserById(existing.id, {
              app_metadata: { is_admin: true },
            });
          }
        } else {
          console.error(`  ❌ Auth error: ${authError.message}`);
          return false;
        }
      } else if (authData?.user) {
        adminUserId = authData.user.id;
        console.log(`  ✅ Admin auth user created (ID: ${adminUserId})`);
      }
    }

    // Step 2: Create or update admin profile
    console.log('  👤 Creating admin profile...');
    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        id: adminUserId,
        username: ADMIN_USER.username,
        display_name: ADMIN_USER.displayName,
        welcome_message_sent: true, // Admin doesn't receive welcome messages
        // #240: THE single source of truth for admin status. Both the UI gate
        // (AdminAuthService.checkIsAdmin → is_admin() RPC) and the server data
        // (RLS + admin_* RPCs → is_admin()) read THIS column, so they can never
        // disagree; custom_access_token_hook derives the JWT claim from it too.
        is_admin: true,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.error(`  ❌ Profile error: ${profileError.message}`);
      return false;
    }
    console.log('  ✅ Admin profile created');

    // Step 3: Check if admin already has a public key
    console.log('  🔑 Checking for existing public key...');
    const { data: existingKey } = await supabase
      .from('user_encryption_keys')
      .select('id, public_key')
      .eq('user_id', adminUserId)
      .eq('revoked', false)
      .maybeSingle();

    if (existingKey?.public_key) {
      console.log('  ℹ️  Admin public key already exists, skipping generation');
      console.log(`     Key ID: ${existingKey.id}`);
      return true;
    }

    // Step 4: Generate ECDH P-256 keypair
    console.log('  🔐 Generating ECDH P-256 keypair...');

    // Use Node.js crypto for key generation (Web Crypto API style)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    // Export public key to JWK format
    const publicKeyJwk = publicKey.export({ format: 'jwk' });

    // Verify the JWK has correct structure
    if (
      publicKeyJwk.kty !== 'EC' ||
      publicKeyJwk.crv !== 'P-256' ||
      !publicKeyJwk.x ||
      !publicKeyJwk.y
    ) {
      console.error('  ❌ Invalid JWK structure generated');
      return false;
    }

    console.log('  ✅ Keypair generated');
    console.log(`     Curve: ${publicKeyJwk.crv}`);
    console.log(`     x: ${publicKeyJwk.x?.substring(0, 20)}...`);
    console.log(`     y: ${publicKeyJwk.y?.substring(0, 20)}...`);

    // Step 5: Store public key in database
    console.log('  💾 Storing public key in database...');
    const { error: keyError } = await supabase
      .from('user_encryption_keys')
      .insert({
        user_id: adminUserId,
        public_key: publicKeyJwk,
        encryption_salt: null, // No password derivation for admin
        device_id: null,
        expires_at: null, // Never expires
        revoked: false,
      });

    if (keyError) {
      console.error(`  ❌ Key storage error: ${keyError.message}`);
      return false;
    }

    console.log('  ✅ Public key stored');

    // Step 6: Discard private key (not needed)
    // privateKey goes out of scope and is garbage collected
    console.log('  🗑️  Private key discarded (not needed at runtime)');

    console.log(`\n  ✨ Admin user setup complete!`);
    console.log(`     Email: ${ADMIN_USER.email}`);
    console.log(`     Username: ${ADMIN_USER.username}`);
    console.log(`     User ID: ${adminUserId}`);

    return true;
  } catch (error) {
    console.error('  ❌ Admin setup failed:', error);
    return false;
  }
}

async function cleanupUserData(userId: string): Promise<void> {
  // Delete in order to respect foreign key constraints
  // 1. Messages (references conversations)
  await supabase.from('messages').delete().eq('sender_id', userId);

  // 2. Conversation keys (references conversations and users)
  await supabase.from('conversation_keys').delete().eq('user_id', userId);

  // 3. Typing indicators
  await supabase.from('typing_indicators').delete().eq('user_id', userId);

  // 4. Conversations (user is participant)
  await supabase.from('conversations').delete().eq('participant_1_id', userId);
  await supabase.from('conversations').delete().eq('participant_2_id', userId);

  // 5. User connections
  await supabase.from('user_connections').delete().eq('requester_id', userId);
  await supabase.from('user_connections').delete().eq('addressee_id', userId);

  // 6. Encryption keys
  await supabase.from('user_encryption_keys').delete().eq('user_id', userId);

  // 7. User profile
  await supabase.from('user_profiles').delete().eq('id', userId);
}

async function createTestUser(user: TestUser): Promise<boolean> {
  const { email, password, username, displayName } = user;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Creating: ${email}`);
  console.log(`${'─'.repeat(50)}`);

  try {
    // Step 1: Check if auth user already exists by email
    console.log('  🔍 Checking if user exists...');
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find((u) => u.email === email);

    if (existingAuthUser) {
      console.log(`  ⚠️  Auth user "${email}" exists, cleaning up...`);
      await cleanupUserData(existingAuthUser.id);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        existingAuthUser.id
      );
      if (deleteError) {
        console.log(`  ⚠️  Could not delete auth user: ${deleteError.message}`);
        // Continue anyway - we'll try to update it
      } else {
        console.log('  ✅ Existing auth user deleted');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Also check profiles by username (orphaned profiles)
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', username)
      .maybeSingle();

    if (existingProfile && existingProfile.id !== existingAuthUser?.id) {
      console.log(
        `  ⚠️  Orphaned profile "${username}" exists, cleaning up...`
      );
      await cleanupUserData(existingProfile.id);
      await supabase.auth.admin.deleteUser(existingProfile.id).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Step 2: Create auth user
    console.log('  🔐 Creating auth user...');
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username },
      });

    if (authError) {
      // If user already exists, try to get their ID
      if (authError.code === 'email_exists') {
        console.log('  ℹ️  Auth user already exists, updating profile...');
        const existingUser = authUsers?.users?.find((u) => u.email === email);
        if (existingUser) {
          // Use upsert for profile
          const { error: upsertError } = await supabase
            .from('user_profiles')
            .upsert(
              {
                id: existingUser.id,
                username,
                display_name: displayName,
              },
              { onConflict: 'id' }
            );

          if (upsertError) {
            console.error(`  ❌ Profile upsert error: ${upsertError.message}`);
            return false;
          }
          console.log(`  ✅ Profile upserted`);
          console.log(`     Email: ${email}`);
          console.log(`     Username: ${username}`);
          return true;
        }
      }
      console.error(`  ❌ Auth error: ${authError.message}`);
      return false;
    }

    if (!authData.user) {
      console.error('  ❌ User creation succeeded but no user data returned');
      return false;
    }

    const userId = authData.user.id;
    console.log(`  ✅ Auth user created (ID: ${userId})`);

    // Step 3: Create or update user profile using upsert
    console.log('  👤 Creating profile...');
    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        id: userId,
        username,
        display_name: displayName,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.error(`  ❌ Profile error: ${profileError.message}`);
      await supabase.auth.admin.deleteUser(userId);
      return false;
    }

    console.log(`  ✅ Profile created`);
    console.log(`     Email: ${email}`);
    console.log(`     Username: ${username}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to create ${email}:`, error);
    return false;
  }
}

async function main() {
  console.log('🔧 Seed Test Users Script');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  // T006: Setup admin user FIRST (required for welcome messages)
  console.log('\n📋 Step 1: Setting up admin user for welcome messages...');
  const adminSuccess = await setupAdminUser();

  if (!adminSuccess) {
    console.error('\n❌ Admin setup failed - cannot continue');
    process.exit(1);
  }

  // Then create test users
  console.log(`\n📋 Step 2: Creating ${TEST_USERS.length} test users...`);

  const results: boolean[] = [];

  for (const user of TEST_USERS) {
    const success = await createTestUser(user);
    results.push(success);
  }

  const successCount = results.filter(Boolean).length;

  console.log(`\n${'='.repeat(60)}`);
  if (successCount === TEST_USERS.length && adminSuccess) {
    console.log('✨ All users created successfully!');
  } else {
    console.log(`⚠️  Created ${successCount}/${TEST_USERS.length} test users`);
    console.log(`   Admin: ${adminSuccess ? '✅' : '❌'}`);
  }

  console.log('\n📋 Users:');
  console.log(`   Admin: ${ADMIN_USER.email} (for welcome messages)`);
  for (const user of TEST_USERS) {
    console.log(`   Test: ${user.email} / ${user.password}`);
  }

  console.log('\n📋 Next steps:');
  console.log('   1. Run tests: docker compose exec scripthammer pnpm test');
  console.log(
    '   2. Run E2E: docker compose exec scripthammer pnpm exec playwright test'
  );
  console.log(`${'='.repeat(60)}\n`);

  if (successCount < TEST_USERS.length) {
    process.exit(1);
  }
}

main();

#!/usr/bin/env ts-node
/**
 * Seed script for creating all test users
 * Creates:
 *   - Primary: test@example.com / TestPassword123! (username: testuser)
 *   - Secondary: test-user-b@example.com / TestPassword456! (username: testuser-b)
 *
 * Usage: docker compose exec scripthammer pnpm exec tsx scripts/seed-test-users.ts
 * Environment: Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const TEST_USERS: TestUser[] = [
  {
    email: 'test@example.com',
    password: 'TestPassword123!',
    username: 'testuser',
    displayName: 'Test User',
  },
  {
    email: 'test-user-b@example.com',
    password: 'TestPassword456!',
    username: 'testuser-b',
    displayName: 'Test User B',
  },
];

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
  console.log(`📋 Creating ${TEST_USERS.length} test users...`);

  const results: boolean[] = [];

  for (const user of TEST_USERS) {
    const success = await createTestUser(user);
    results.push(success);
  }

  const successCount = results.filter(Boolean).length;

  console.log(`\n${'='.repeat(60)}`);
  if (successCount === TEST_USERS.length) {
    console.log('✨ All test users created successfully!');
  } else {
    console.log(`⚠️  Created ${successCount}/${TEST_USERS.length} users`);
  }

  console.log('\n📋 Test User Credentials:');
  for (const user of TEST_USERS) {
    console.log(`   ${user.email} / ${user.password}`);
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

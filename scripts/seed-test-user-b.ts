#!/usr/bin/env ts-node
/**
 * Seed script for creating Test User B (tertiary test user)
 * Creates: test-user-b@example.com / TestPassword456! with username testuser-b
 *
 * Usage: docker compose exec scripthammer node --loader ts-node/esm scripts/seed-test-user-b.ts
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

const EMAIL = 'test-user-b@example.com';
const PASSWORD = 'TestPassword456!';
const USERNAME = 'testuser-b';
const DISPLAY_NAME = 'Test User B';

console.log('🔧 Starting Test User B seed script...');
console.log(`📍 Supabase URL: ${supabaseUrl}`);
console.log(`📧 Creating user: ${EMAIL}`);

async function main() {
  try {
    // Step 1: Check if user already exists
    console.log('\n🔍 Step 1: Checking if user already exists...');
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', USERNAME)
      .maybeSingle();

    if (existingUser) {
      console.log(
        `⚠️  User with username "${USERNAME}" already exists (ID: ${existingUser.id})`
      );
      console.log('   Deleting existing user and profile...');

      // Delete profile first (in case cascade isn't working)
      await supabase.from('user_profiles').delete().eq('id', existingUser.id);

      // Delete user via admin API (cascades to identities)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        existingUser.id
      );
      if (deleteError) {
        console.error(
          '❌ Failed to delete existing user:',
          deleteError.message
        );
        throw deleteError;
      }
      console.log('✅ Existing user and profile deleted');

      // Wait a moment for cascade deletes
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Also check for orphaned profiles
    const { data: orphanedProfiles } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', USERNAME);

    if (orphanedProfiles && orphanedProfiles.length > 0) {
      console.log(
        `⚠️  Found ${orphanedProfiles.length} orphaned profile(s), cleaning up...`
      );
      for (const profile of orphanedProfiles) {
        await supabase.from('user_profiles').delete().eq('id', profile.id);
      }
      console.log('✅ Orphaned profiles cleaned up');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Step 2: Create auth user with confirmed email
    console.log('\n🔐 Step 2: Creating auth user...');
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          username: USERNAME,
        },
      });

    if (authError) {
      console.error('❌ Failed to create auth user:', authError.message);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('User creation succeeded but no user data returned');
    }

    const userId = authData.user.id;
    console.log(`✅ Auth user created (ID: ${userId})`);
    console.log(`   Email: ${authData.user.email}`);
    console.log(
      `   Email confirmed: ${authData.user.email_confirmed_at ? 'Yes' : 'No'}`
    );

    // Check for orphaned profile with this ID
    const { data: orphanedProfileById } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle();

    if (orphanedProfileById) {
      console.log(`⚠️  Found orphaned profile with ID ${userId}, deleting...`);
      await supabase.from('user_profiles').delete().eq('id', userId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('✅ Orphaned profile deleted');
    }

    // Step 3: Create user profile
    console.log('\n👤 Step 3: Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        username: USERNAME,
        display_name: DISPLAY_NAME,
      });

    if (profileError) {
      console.error('❌ Failed to create user profile:', profileError.message);
      console.error('   Rolling back: deleting auth user...');
      await supabase.auth.admin.deleteUser(userId);
      throw profileError;
    }

    console.log('✅ User profile created');
    console.log(`   Username: ${USERNAME}`);
    console.log(`   Display name: ${DISPLAY_NAME}`);

    // Step 4: Verify complete setup
    console.log('\n✅ Step 4: Verifying setup...');
    const { data: profile, error: verifyError } = await supabase
      .from('user_profiles')
      .select('id, username, display_name')
      .eq('id', userId)
      .single();

    if (verifyError || !profile) {
      console.warn('⚠️  Verification failed - profile not found');
    } else {
      console.log('✅ Verification successful!');
      console.log('   Profile details:');
      console.log(`     - ID: ${profile.id}`);
      console.log(`     - Username: ${profile.username}`);
      console.log(`     - Display name: ${profile.display_name}`);
    }

    // Success!
    console.log(`\n${'='.repeat(60)}`);
    console.log('✨ Test User B created successfully!');
    console.log(`\n📋 Credentials:`);
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   Username: ${USERNAME}`);
    console.log(`\n📋 Next steps:`);
    console.log(
      `   1. Test sign-in at ${supabaseUrl.replace('supabase.co', 'supabase.co')}`
    );
    console.log(
      `   2. Run E2E tests: docker compose exec scripthammer pnpm exec playwright test`
    );
    console.log(
      `   3. Verify both test users can connect and message each other`
    );
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error('\n❌ Seed script failed:');
    console.error(error);
    console.error('\n💡 Troubleshooting:');
    console.error(
      '   1. Check Supabase dashboard: https://supabase.com/dashboard'
    );
    console.error(
      '   2. Verify SUPABASE_SERVICE_ROLE_KEY has admin permissions'
    );
    console.error('   3. Check RLS policies on user_profiles table');
    console.error(
      '   4. Try manually: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/users'
    );
    process.exit(1);
  }
}

main();

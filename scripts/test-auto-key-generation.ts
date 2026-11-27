#!/usr/bin/env tsx
/**
 * Test Auto-Key Generation on Login
 * Verifies that encryption keys are automatically generated when a user signs in
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testAutoKeyGeneration() {
  console.log('🔐 Testing Auto-Key Generation on Login\n');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Test user credentials (testuser2)
  const testEmail = 'testuser2@example.com';
  const testPassword = process.env.TEST_USER_PRIMARY_PASSWORD;
  if (!testPassword) {
    throw new Error('Missing TEST_USER_PRIMARY_PASSWORD in the environment');
  }

  try {
    // Step 1: Check if testuser2 has keys before login
    console.log('Step 1: Checking existing keys for testuser2...');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', 'testuser2')
      .single();

    if (!profile) {
      console.error('❌ testuser2 profile not found');
      return;
    }

    const { data: existingKeys } = await supabase
      .from('user_encryption_keys')
      .select('id, created_at')
      .eq('user_id', profile.id);

    if (existingKeys && existingKeys.length > 0) {
      console.log('✅ testuser2 already has encryption keys');
      console.log(`   Keys created at: ${existingKeys[0].created_at}`);
      console.log('\n✨ Auto-key-generation already working!');
      return;
    } else {
      console.log('⚠️  testuser2 has NO encryption keys yet');
      console.log(
        '   To test auto-generation, sign in as testuser2 in the browser:'
      );
      console.log('   1. Go to http://localhost:3000/sign-in');
      console.log(`   2. Email: ${testEmail}`);
      console.log(`   3. Password: ${testPassword}`);
      console.log(
        "   4. Check browser console for 'Initializing encryption keys...'"
      );
      console.log(
        '\n   After signing in, run this script again to verify keys were created.'
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAutoKeyGeneration();

#!/usr/bin/env tsx
/**
 * Initialize proper password-derived encryption keys for test users
 * This replaces legacy null-salt keys with proper Argon2id-derived keys
 */

import { createClient } from '@supabase/supabase-js';
import { KeyDerivationService } from '../src/lib/messaging/key-derivation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test user credentials
const TEST_USERS = [
  { username: 'testuser', password: 'TestPassword123!' },
  { username: 'testuser-b', password: 'TestPassword123!' },
];

async function initializeTestKeys() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const keyDerivationService = new KeyDerivationService();

  for (const testUser of TEST_USERS) {
    console.log(`\n=== Processing ${testUser.username} ===`);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', testUser.username)
      .single();

    if (profileError || !profile) {
      console.log(`User ${testUser.username} not found, skipping`);
      continue;
    }

    console.log(`Found user: ${profile.id}`);

    // Revoke all existing keys (mark as revoked, don't delete)
    const { error: revokeError, count: revokedCount } = await supabase
      .from('user_encryption_keys')
      .update({ revoked: true })
      .eq('user_id', profile.id)
      .eq('revoked', false);

    if (revokeError) {
      console.error(`Failed to revoke old keys:`, revokeError.message);
    } else {
      console.log(`Revoked ${revokedCount ?? 'existing'} old keys`);
    }

    // Generate new password-derived keys
    console.log('Generating new password-derived key pair...');
    const salt = keyDerivationService.generateSalt();

    const keyPair = await keyDerivationService.deriveKeyPair({
      password: testUser.password,
      salt,
    });

    console.log(`Salt (base64): ${keyPair.salt.substring(0, 20)}...`);
    console.log(`Public key generated`);

    // Insert new key with salt
    const { error: insertError } = await supabase
      .from('user_encryption_keys')
      .insert({
        user_id: profile.id,
        public_key: keyPair.publicKeyJwk,
        encryption_salt: keyPair.salt, // Base64-encoded salt
        device_id: null,
        expires_at: null,
        revoked: false,
      });

    if (insertError) {
      console.error('Failed to insert new key:', insertError.message);
    } else {
      console.log('✅ New password-derived key created successfully');
    }
  }

  console.log('\n=== Verification ===');

  // Verify the new keys
  for (const testUser of TEST_USERS) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', testUser.username)
      .single();

    if (!profile) continue;

    const { data: keys } = await supabase
      .from('user_encryption_keys')
      .select('id, encryption_salt, revoked')
      .eq('user_id', profile.id)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (keys && keys.length > 0) {
      const hasValidSalt = keys[0].encryption_salt !== null;
      console.log(
        `${testUser.username}: ${hasValidSalt ? '✅ Has valid salt' : '❌ Missing salt'}`
      );
    } else {
      console.log(`${testUser.username}: ❌ No active keys`);
    }
  }

  console.log(
    '\n🎉 Done! Users can now unlock messaging with password: TestPassword123!'
  );
}

initializeTestKeys();

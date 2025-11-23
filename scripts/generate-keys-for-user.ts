#!/usr/bin/env tsx
/**
 * Directly generate encryption keys for a user
 * Bypasses the need for sign-in
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function generateKeysForUser(username: string) {
  console.log(`🔐 Generating encryption keys for ${username}...\n`);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', username)
      .single();

    if (profileError || !profile) {
      console.error(`❌ User '${username}' not found`);
      return;
    }

    console.log(`✅ Found user: ${profile.username} (${profile.id})`);

    // Check if user already has keys
    const { data: existingKeys } = await supabase
      .from('user_encryption_keys')
      .select('id')
      .eq('user_id', profile.id);

    if (existingKeys && existingKeys.length > 0) {
      console.log(`⚠️  User already has encryption keys - skipping`);
      return;
    }

    // Generate ECDH P-256 key pair
    console.log('🔑 Generating ECDH P-256 key pair...');

    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveBits', 'deriveKey']
    );

    // Export public key
    const publicKeyJwk = await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );

    // Insert public key into database
    const { error: insertError } = await supabase
      .from('user_encryption_keys')
      .insert({
        user_id: profile.id,
        public_key: publicKeyJwk,
        device_id: 'server-generated',
      });

    if (insertError) {
      console.error('❌ Failed to insert public key:', insertError.message);
      return;
    }

    console.log('✅ Public key stored in database');
    console.log('\n✨ Encryption keys generated successfully!');
    console.log(
      '   Note: Private key was NOT stored (zero-knowledge encryption)'
    );
    console.log(
      '   User will generate their own private key on first sign-in\n'
    );
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Generate keys for testuser2
const username = process.argv[2] || 'testuser2';
generateKeysForUser(username);

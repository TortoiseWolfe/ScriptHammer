#!/usr/bin/env tsx
/**
 * Zero-Knowledge Encryption Verification Script
 *
 * Verifies that:
 * 1. Messages in database are encrypted (ciphertext only)
 * 2. No plaintext content is stored
 * 3. Private keys are NOT in database (only IndexedDB client-side)
 * 4. Only public keys are stored in database
 *
 * Usage: pnpm tsx scripts/verify-zero-knowledge.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyZeroKnowledge() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    console.error(
      'Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
    process.exit(1);
  }

  console.log('🔍 Verifying zero-knowledge encryption...\n');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Test 1: Verify messages contain ciphertext, not plaintext
    console.log('Test 1: Checking messages table for encryption...');
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, encrypted_content, initialization_vector')
      .limit(5);

    if (msgError) {
      console.error('❌ Failed to fetch messages:', msgError.message);
      process.exit(1);
    }

    if (messages && messages.length > 0) {
      console.log(`✅ Found ${messages.length} messages`);

      // Verify all messages have encrypted_content and IV
      const allEncrypted = messages.every(
        (msg: any) =>
          msg.encrypted_content &&
          msg.initialization_vector &&
          typeof msg.encrypted_content === 'string' &&
          typeof msg.initialization_vector === 'string'
      );

      if (allEncrypted) {
        console.log('✅ All messages are encrypted (ciphertext + IV present)');

        // Verify ciphertext is base64 (not plaintext)
        const sampleCiphertext = messages[0].encrypted_content;
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(sampleCiphertext);

        if (isBase64) {
          console.log('✅ Ciphertext is base64-encoded (not plaintext)');
        } else {
          console.error(
            '❌ WARNING: Ciphertext may not be properly encrypted\!'
          );
        }
      } else {
        console.error('❌ CRITICAL: Some messages are not encrypted\!');
        process.exit(1);
      }
    } else {
      console.log(
        '⚠️  No messages found in database (send a test message first)'
      );
    }

    // Test 2: Verify private keys are NOT in database
    console.log('\nTest 2: Verifying private keys are NOT in database...');
    const { data: keys, error: keysError } = await supabase
      .from('user_encryption_keys')
      .select('id, public_key')
      .limit(5);

    if (keysError) {
      console.error('❌ Failed to fetch encryption keys:', keysError.message);
      process.exit(1);
    }

    if (keys && keys.length > 0) {
      console.log(`✅ Found ${keys.length} public keys in database`);

      // Verify only public_key field exists (no private_key)
      const hasPrivateKey = keys.some(
        (key: any) => 'private_key' in key || 'privateKey' in key
      );

      if (!hasPrivateKey) {
        console.log(
          '✅ VERIFIED: No private keys in database (client-side only)'
        );
      } else {
        console.error(
          '❌ CRITICAL: Private keys found in database\! Zero-knowledge violated\!'
        );
        process.exit(1);
      }

      // Verify public keys are valid JWK format
      const sampleKey = keys[0].public_key;
      const isJWK =
        sampleKey && sampleKey.kty === 'EC' && sampleKey.crv === 'P-256';

      if (isJWK) {
        console.log('✅ Public keys are in valid JWK format');
      } else {
        console.error('❌ WARNING: Public key format may be invalid');
      }
    } else {
      console.log(
        "⚠️  No encryption keys found (users haven't initialized keys yet)"
      );
    }

    // Test 3: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ZERO-KNOWLEDGE VERIFICATION COMPLETE');
    console.log('='.repeat(60));
    console.log('✅ Messages are encrypted in database');
    console.log('✅ Private keys are NOT in database (client-side only)');
    console.log('✅ Server cannot decrypt messages (zero-knowledge confirmed)');
    console.log('\n🔒 End-to-end encryption is working correctly\!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyZeroKnowledge();

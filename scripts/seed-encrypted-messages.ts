#!/usr/bin/env tsx
/**
 * Seed Properly Encrypted Test Messages
 * Creates encrypted messages between test users using password-derived keys
 */

import { createClient } from '@supabase/supabase-js';
import { KeyDerivationService } from '../src/lib/messaging/key-derivation';
import { CRYPTO_PARAMS } from '../src/types/messaging';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test user credentials (same password for both)
const TEST_PASSWORD = 'TestPassword123!';

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Derive AES shared secret from ECDH keys
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: CRYPTO_PARAMS.ALGORITHM,
      public: publicKey,
    },
    privateKey,
    {
      name: CRYPTO_PARAMS.AES_ALGORITHM,
      length: CRYPTO_PARAMS.AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// Helper: Encrypt a message
async function encryptMessage(
  plaintext: string,
  sharedSecret: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(
    new Uint8Array(CRYPTO_PARAMS.IV_LENGTH_BYTES)
  );
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: CRYPTO_PARAMS.AES_ALGORITHM, iv },
    sharedSecret,
    plaintextBytes
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

async function seedMessages() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const keyDerivationService = new KeyDerivationService();

  console.log('Fetching test users...');

  // Get test users and their encryption keys
  const users: {
    id: string;
    username: string;
    salt: string;
    publicKey: JsonWebKey;
    privateKey: CryptoKey;
  }[] = [];

  for (const username of ['testuser', 'testuser-b']) {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', username)
      .single();

    if (profileError || !profile) {
      console.error(`User ${username} not found`);
      process.exit(1);
    }

    const { data: keyData, error: keyError } = await supabase
      .from('user_encryption_keys')
      .select('encryption_salt, public_key')
      .eq('user_id', profile.id)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (keyError || !keyData?.encryption_salt) {
      console.error(`No valid encryption key for ${username}`);
      console.error(
        'Run: docker compose exec scripthammer pnpm exec tsx scripts/initialize-test-keys.ts'
      );
      process.exit(1);
    }

    // Derive keys from password
    const saltBytes = Uint8Array.from(atob(keyData.encryption_salt), (c) =>
      c.charCodeAt(0)
    );
    const keyPair = await keyDerivationService.deriveKeyPair({
      password: TEST_PASSWORD,
      salt: saltBytes,
    });

    users.push({
      id: profile.id,
      username,
      salt: keyData.encryption_salt,
      publicKey: keyData.public_key,
      privateKey: keyPair.privateKey,
    });

    console.log(`  ${username}: keys loaded`);
  }

  const [user1, user2] = users;

  // Import user2's public key for encryption
  const user2PublicKeyCrypto = await crypto.subtle.importKey(
    'jwk',
    user2.publicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret (user1 private + user2 public)
  const sharedSecret = await deriveSharedSecret(
    user1.privateKey,
    user2PublicKeyCrypto
  );

  console.log('\nShared secret derived successfully');

  // Get or create conversation
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(participant_1_id.eq.${user1.id},participant_2_id.eq.${user2.id}),and(participant_1_id.eq.${user2.id},participant_2_id.eq.${user1.id})`
    )
    .limit(1)
    .single();

  let conversationId: string;

  if (existingConv) {
    conversationId = existingConv.id;
    console.log('Using existing conversation:', conversationId);
  } else {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        participant_1_id: user1.id,
        participant_2_id: user2.id,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (convError || !newConv) {
      console.error('Failed to create conversation:', convError?.message);
      process.exit(1);
    }
    conversationId = newConv.id;
    console.log('Created new conversation:', conversationId);
  }

  // Delete existing messages in this conversation (start fresh)
  const { error: deleteError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (deleteError) {
    console.error('Failed to delete old messages:', deleteError.message);
  } else {
    console.log('Cleared existing messages');
  }

  // Create encrypted messages
  const testMessages = [
    { sender: user1, content: 'Hey! How are you doing?' },
    { sender: user2, content: "I'm good! Just working on some code." },
    { sender: user1, content: 'Nice! What are you building?' },
    { sender: user2, content: 'A messaging app with E2E encryption!' },
    {
      sender: user1,
      content: "That's awesome! How's the key derivation coming along?",
    },
    {
      sender: user2,
      content:
        'Finally got Argon2id working with password-derived keys. Much more secure!',
    },
  ];

  console.log('\nCreating encrypted messages...');

  for (let i = 0; i < testMessages.length; i++) {
    const msg = testMessages[i];

    // We need the shared secret between the two parties
    // Since ECDH produces same shared secret from either direction, use the one we have
    const encrypted = await encryptMessage(msg.content, sharedSecret);

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: msg.sender.id,
      encrypted_content: encrypted.ciphertext,
      initialization_vector: encrypted.iv,
      sequence_number: i + 1,
      deleted: false,
      edited: false,
    });

    if (insertError) {
      console.error(`Failed to insert message ${i + 1}:`, insertError.message);
    } else {
      console.log(
        `  [${i + 1}] ${msg.sender.username}: "${msg.content.substring(0, 30)}..."`
      );
    }
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  console.log('\n=== Done! ===');
  console.log('Created', testMessages.length, 'encrypted messages');
  console.log('\nTo test:');
  console.log('1. Open http://localhost:3000/messages');
  console.log('2. Sign in as test@example.com with TestPassword123!');
  console.log('3. Enter TestPassword123! in the "Unlock Messaging" modal');
  console.log('4. You should see the decrypted messages!');
}

seedMessages();

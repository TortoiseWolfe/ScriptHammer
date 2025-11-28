#!/usr/bin/env node
/**
 * Send a properly encrypted test message
 * Uses Web Crypto API (Node.js 19+) to match the app's encryption
 */

import { webcrypto } from 'crypto';
const { subtle } = webcrypto;

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// User IDs
const SENDER_ID = 'f5ac9d6f-9c7a-4958-8ebb-02d2718afec0'; // test@example.com
const RECIPIENT_ID = '42e341aa-aeb8-4280-8a93-09586e8e0a23'; // JonPohlner
const CONVERSATION_ID = '2cee2a50-f499-405d-94df-f081f935f7b8';

async function main() {
  console.log('1. Generating sender key pair...');
  const senderKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey']
  );

  const senderPublicJwk = await subtle.exportKey(
    'jwk',
    senderKeyPair.publicKey
  );
  console.log('   Sender public key generated');

  console.log('2. Fetching recipient public key...');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_encryption_keys?user_id=eq.${RECIPIENT_ID}&select=public_key`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  const [keyRow] = await res.json();
  if (!keyRow?.public_key) {
    throw new Error('Recipient has no public key');
  }

  const recipientPublicJwk = keyRow.public_key;
  console.log('   Recipient public key fetched');

  console.log('3. Importing recipient public key...');
  const recipientPublicKey = await subtle.importKey(
    'jwk',
    { ...recipientPublicJwk, key_ops: [] },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  console.log('4. Deriving shared secret...');
  const sharedSecret = await subtle.deriveKey(
    { name: 'ECDH', public: recipientPublicKey },
    senderKeyPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  console.log('5. Encrypting message...');
  const message =
    'Hello Jon! This is a real encrypted message from the test user.';
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedSecret,
    encoder.encode(message)
  );

  // Convert to base64
  const ciphertextB64 = Buffer.from(ciphertext).toString('base64');
  const ivB64 = Buffer.from(iv).toString('base64');
  console.log('   Message encrypted');

  console.log('6. Updating sender public key in database...');
  // Delete old keys for sender
  await fetch(
    `${SUPABASE_URL}/rest/v1/user_encryption_keys?user_id=eq.${SENDER_ID}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );

  // Insert new key
  await fetch(`${SUPABASE_URL}/rest/v1/user_encryption_keys`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: SENDER_ID,
      public_key: senderPublicJwk,
      encryption_salt: 'dGVzdHNhbHQ=',
    }),
  });
  console.log('   Sender key updated');

  console.log('7. Deleting old messages...');
  await fetch(
    `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${CONVERSATION_ID}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );

  console.log('8. Inserting encrypted message...');
  const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      conversation_id: CONVERSATION_ID,
      sender_id: SENDER_ID,
      encrypted_content: ciphertextB64,
      initialization_vector: ivB64,
      sequence_number: 1,
    }),
  });

  const msgData = await msgRes.json();
  console.log('   Message inserted:', msgData[0]?.id);

  console.log(
    '\n✅ Done! Refresh the messages page to see the encrypted message.'
  );
}

main().catch(console.error);

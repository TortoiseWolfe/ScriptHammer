#!/usr/bin/env tsx
/**
 * Database Reset Script
 * Feature: 007-feature-007-db-reset
 *
 * Resets the database by deleting all user data and re-seeding:
 * 1. Deletes all messages, conversations, connections, keys
 * 2. Deletes all user profiles and auth users (except admin)
 * 3. Re-runs seed-test-users.ts to recreate test data
 *
 * NOTE: This does NOT drop/recreate tables (schema stays intact).
 * For a full schema reset, run the SQL files manually in Supabase Dashboard:
 *   1. supabase/migrations/999_drop_all_tables.sql
 *   2. supabase/migrations/20251006_complete_monolithic_setup.sql
 *
 * Usage: docker compose exec scripthammer pnpm run db:reset
 *
 * CAUTION: This will DELETE ALL DATA. Requires typing "RESET" to confirm.
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required env vars
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('Required:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Admin user ID (preserved during reset)
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

// Create Supabase admin client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Delete all data from a table
 */
async function deleteAllFromTable(
  table: string,
  description: string
): Promise<void> {
  console.log(`  🗑️  Deleting ${description}...`);
  const { error } = await supabase
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    // Some tables might be empty or have constraints - that's ok
    console.log(`     ⚠️  ${error.message}`);
  } else {
    console.log(`     ✅ ${description} deleted`);
  }
}

/**
 * Delete all auth users except admin
 */
async function deleteAllAuthUsers(): Promise<void> {
  console.log('  🗑️  Deleting auth users (except admin)...');

  const { data: users, error: listError } =
    await supabase.auth.admin.listUsers();
  if (listError) {
    console.log(`     ⚠️  Could not list users: ${listError.message}`);
    return;
  }

  const usersToDelete = users.users.filter((u) => u.id !== ADMIN_USER_ID);
  console.log(`     Found ${usersToDelete.length} users to delete`);

  for (const user of usersToDelete) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.log(`     ⚠️  Could not delete ${user.email}: ${error.message}`);
    }
  }

  console.log('     ✅ Auth users cleaned up');
}

/**
 * Create test messages for scroll testing
 * Creates 30 messages between admin and primary test user
 */
async function createTestMessages(): Promise<void> {
  console.log('  💬 Creating test messages for scroll testing...');

  // Get primary test user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUser = users?.users?.find((u) => u.email === 'test@example.com');

  if (!testUser) {
    console.log('     ⚠️  Primary test user not found, skipping messages');
    return;
  }

  const testUserId = testUser.id;

  // Create conversation between admin and test user
  // Canonical ordering: participant_1 < participant_2 (UUID comparison)
  const [participant1, participant2] = [ADMIN_USER_ID, testUserId].sort();

  console.log('     Creating conversation...');
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      participant_1_id: participant1,
      participant_2_id: participant2,
    })
    .select('id')
    .single();

  if (convError) {
    console.log(`     ⚠️  Could not create conversation: ${convError.message}`);
    return;
  }

  const conversationId = conversation.id;
  console.log(`     Conversation ID: ${conversationId}`);

  // Create 30 test messages (alternating senders)
  console.log('     Inserting 30 messages...');
  const messages = [];
  const baseTime = new Date();

  for (let i = 0; i < 30; i++) {
    const isFromAdmin = i % 2 === 0;
    const messageTime = new Date(baseTime.getTime() - (30 - i) * 60000); // 1 min apart

    // Generate unique IV for each message (16 bytes, base64 encoded)
    const ivBytes = Buffer.from(`iv-for-msg-${i.toString().padStart(4, '0')}`);
    const ivBase64 = ivBytes.toString('base64');

    messages.push({
      conversation_id: conversationId,
      sender_id: isFromAdmin ? ADMIN_USER_ID : testUserId,
      encrypted_content: JSON.stringify({
        // Placeholder encrypted content - will show as "[Cannot decrypt]"
        ciphertext: Buffer.from(
          `Test message ${i + 1} for scroll testing`
        ).toString('base64'),
        iv: ivBase64,
        tag: Buffer.from('placeholder-tag-0').toString('base64'),
      }),
      initialization_vector: ivBase64,
      created_at: messageTime.toISOString(),
    });
  }

  const { error: msgError } = await supabase.from('messages').insert(messages);

  if (msgError) {
    console.log(`     ⚠️  Could not insert messages: ${msgError.message}`);
    return;
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: baseTime.toISOString() })
    .eq('id', conversationId);

  console.log('     ✅ 30 test messages created');
  console.log(`     Conversation: Admin <-> test@example.com`);
}

/**
 * Run seed-test-users.ts script
 */
function runSeedScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('  🌱 Running seed-test-users.ts...');

    const child = spawn('pnpm', ['exec', 'tsx', 'scripts/seed-test-users.ts'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`seed-test-users.ts exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Prompt user for confirmation
 */
async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Type "RESET" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'RESET');
    });
  });
}

/**
 * Main reset function
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔥 DATABASE RESET - This will DELETE ALL USER DATA');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Admin ID: ${ADMIN_USER_ID} (preserved)`);
  console.log('');

  // Require confirmation
  const confirmed = await confirmReset();
  if (!confirmed) {
    console.log('❌ Aborted - no changes made');
    process.exit(0);
  }

  console.log('');
  console.log('Starting database reset...');
  console.log('');

  try {
    // Step 1: Delete all messaging data (in dependency order)
    console.log('Step 1/5: Deleting messaging data...');
    await deleteAllFromTable('typing_indicators', 'typing indicators');
    await deleteAllFromTable('messages', 'messages');
    await deleteAllFromTable('conversation_keys', 'conversation keys');
    await deleteAllFromTable('conversations', 'conversations');
    await deleteAllFromTable('user_connections', 'user connections');
    await deleteAllFromTable('user_encryption_keys', 'encryption keys');
    console.log('');

    // Step 2: Delete payment data
    console.log('Step 2/5: Deleting payment data...');
    await deleteAllFromTable('webhook_events', 'webhook events');
    await deleteAllFromTable('payment_results', 'payment results');
    await deleteAllFromTable('subscriptions', 'subscriptions');
    await deleteAllFromTable('payment_intents', 'payment intents');
    console.log('');

    // Step 3: Delete user data
    console.log('Step 3/5: Deleting user data...');
    await deleteAllFromTable('auth_audit_logs', 'audit logs');
    await deleteAllFromTable('rate_limit_attempts', 'rate limit attempts');
    await deleteAllFromTable('oauth_states', 'OAuth states');

    // Delete user profiles except admin
    console.log('  🗑️  Deleting user profiles (except admin)...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .neq('id', ADMIN_USER_ID);
    if (profileError) {
      console.log(`     ⚠️  ${profileError.message}`);
    } else {
      console.log('     ✅ User profiles deleted');
    }

    // Delete auth users
    await deleteAllAuthUsers();
    console.log('');

    // Step 4: Re-seed
    console.log('Step 4/5: Re-seeding test users...');
    await runSeedScript();
    console.log('');

    // Step 5: Create test messages
    console.log('Step 5/5: Creating test messages...');
    await createTestMessages();
    console.log('');
  } catch (error: any) {
    console.error('');
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  }

  // Success summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ DATABASE RESET COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Test credentials:');
  console.log(`  Admin:    admin@scripthammer.com (ScriptHammer)`);
  console.log(
    `  Primary:  test@example.com / ${process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!'}`
  );
  console.log(
    `  Tertiary: test-user-b@example.com / ${process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!'}`
  );
  console.log('');
}

main();

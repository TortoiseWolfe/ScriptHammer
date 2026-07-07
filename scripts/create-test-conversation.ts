#!/usr/bin/env tsx
/**
 * Create Test Conversation for Messaging Demo
 *
 * Creates a conversation between testuser and testuser2
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createTestConversation() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get testuser and testuser2 IDs
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, username')
      .in('username', ['testuser', 'testuser-b']);

    if (!users || users.length < 2) {
      console.error('❌ Need both testuser and testuser2 in database');
      console.log('Found users:', users);
      process.exit(1);
    }

    const user1 = users.find((u) => u.username === 'testuser');
    const user2 = users.find((u) => u.username === 'testuser-b');

    console.log(`\n📝 Creating conversation between:`);
    console.log(`   User 1: ${user1?.username} (${user1?.id})`);
    console.log(`   User 2: ${user2?.username} (${user2?.id})\n`);

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1_id.eq.${user1?.id},participant_2_id.eq.${user2?.id}),and(participant_1_id.eq.${user2?.id},participant_2_id.eq.${user1?.id})`
      )
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`✅ Conversation already exists!`);
      console.log(`   ID: ${existing[0].id}\n`);
      console.log(`🌐 Open in browser:`);
      console.log(
        `   http://localhost:3000/messages?conversation=${existing[0].id}\n`
      );
      return;
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        participant_1_id: user1?.id,
        participant_2_id: user2?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create conversation:', error);
      process.exit(1);
    }

    console.log(`✅ Conversation created successfully!`);
    console.log(`   ID: ${conversation.id}\n`);
    console.log(`🌐 Open in browser:`);
    console.log(
      `   http://localhost:3000/messages?conversation=${conversation.id}\n`
    );
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestConversation();

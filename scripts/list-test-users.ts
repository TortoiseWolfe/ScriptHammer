#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listUsers() {
  console.log('\n📋 ALL USERS IN DATABASE:\n');

  // Get all auth users with their emails
  const {
    data: { users },
    error,
  } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No users found in database');
    return;
  }

  for (const user of users) {
    console.log(`\n👤 Email: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(
      `   Email confirmed: ${user.email_confirmed_at ? '✅ Yes' : '❌ No'}`
    );
    console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);
    console.log(`   Created: ${new Date(user.created_at!).toLocaleString()}`);

    // Get profile info
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('id', user.id)
      .single();

    if (profile) {
      console.log(`   Username: ${profile.username}`);
      console.log(`   Display name: ${profile.display_name || '(none)'}`);
    }
  }

  console.log('\n');
  console.log('🔑 TEST CREDENTIALS (from seed data):');
  console.log('   Email: test@example.com');
  console.log('   Password: TestPassword123!');
  console.log(
    '\n   Note: If testuser2 needs different credentials, they may need to be reset.'
  );
}

listUsers();

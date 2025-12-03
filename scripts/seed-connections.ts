/**
 * Seed Connections Script
 * Creates accepted connections between all test users for E2E testing
 *
 * Usage: npx tsx scripts/seed-connections.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedConnections() {
  console.log('Seeding connections between test users...');

  const { data: usersData, error: usersError } =
    await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('Failed to list users:', usersError.message);
    process.exit(1);
  }

  const users = usersData.users;
  console.log('Found ' + users.length + ' users:');
  users.forEach((u) => console.log('  - ' + u.email + ' (' + u.id + ')'));

  if (users.length < 2) {
    console.log('Need at least 2 users to create connections');
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const user1 = users[i];
      const user2 = users[j];

      const { data: existing } = await supabase
        .from('user_connections')
        .select('id')
        .or(
          'and(requester_id.eq.' +
            user1.id +
            ',addressee_id.eq.' +
            user2.id +
            '),' +
            'and(requester_id.eq.' +
            user2.id +
            ',addressee_id.eq.' +
            user1.id +
            ')'
        )
        .maybeSingle();

      if (existing) {
        console.log('Skipped (exists): ' + user1.email + ' <-> ' + user2.email);
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase
        .from('user_connections')
        .insert({
          requester_id: user1.id,
          addressee_id: user2.id,
          status: 'accepted',
        });

      if (insertError) {
        console.error(
          'Failed: ' +
            user1.email +
            ' <-> ' +
            user2.email +
            ' - ' +
            insertError.message
        );
      } else {
        console.log('Created: ' + user1.email + ' <-> ' + user2.email);
        created++;
      }
    }
  }

  console.log('\nSummary: Created=' + created + ', Skipped=' + skipped);

  const { data: connections } = await supabase
    .from('user_connections')
    .select('id');

  console.log('Total connections in database: ' + (connections?.length || 0));
}

seedConnections().catch(console.error);

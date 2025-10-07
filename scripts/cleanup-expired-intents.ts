#!/usr/bin/env tsx
/**
 * Payment Intent Cleanup Script
 * Deletes expired payment intents that are older than 24 hours past their expiration
 * REQ-SEC-002: Data retention and cleanup
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupExpiredIntents() {
  console.log('🧹 Starting cleanup of expired payment intents...\n');

  try {
    // Calculate cutoff time (24 hours ago)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`📅 Cutoff date: ${cutoffDate.toLocaleString()}`);
    console.log(`   (Deleting intents expired before ${cutoffISO})\n`);

    // First, count how many will be deleted
    const { count, error: countError } = await supabase
      .from('payment_intents')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', cutoffISO);

    if (countError) {
      console.error('❌ Error counting expired intents:', countError.message);
      throw countError;
    }

    if (!count || count === 0) {
      console.log('✅ No expired payment intents to clean up.');
      return;
    }

    console.log(`🔍 Found ${count} expired payment intent(s) to delete.\n`);

    // Delete expired intents
    const { data: deletedIntents, error: deleteError } = await supabase
      .from('payment_intents')
      .delete()
      .lt('expires_at', cutoffISO)
      .select('id, customer_email, expires_at');

    if (deleteError) {
      console.error('❌ Error deleting expired intents:', deleteError.message);
      throw deleteError;
    }

    if (deletedIntents && deletedIntents.length > 0) {
      console.log(
        `✅ Successfully deleted ${deletedIntents.length} payment intent(s):\n`
      );
      deletedIntents.forEach((intent, index) => {
        const expiredDate = new Date(intent.expires_at);
        console.log(`   ${index + 1}. ID: ${intent.id.substring(0, 8)}...`);
        console.log(`      Email: ${intent.customer_email}`);
        console.log(`      Expired: ${expiredDate.toLocaleString()}\n`);
      });
    }

    console.log('🎉 Cleanup completed successfully!');
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupExpiredIntents()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

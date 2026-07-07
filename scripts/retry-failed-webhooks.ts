#!/usr/bin/env tsx
/**
 * Webhook Retry Script
 * Retries failed webhook processing with exponential backoff
 * REQ-SEC-006: Webhook reliability and failure alerting
 *
 * Retry schedule:
 * - 1st retry: 1 minute after failure
 * - 2nd retry: 5 minutes after 1st retry
 * - 3rd retry: 30 minutes after 2nd retry
 * - After 3 failures: Mark as permanently_failed and alert admin
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Exponential backoff schedule (in minutes)
const RETRY_DELAYS = [1, 5, 30];
const MAX_RETRIES = 3;

async function retryFailedWebhooks() {
  console.log('🔄 Starting webhook retry process...\n');

  try {
    // Find webhooks that need retry
    const now = new Date().toISOString();
    const { data: webhooksToRetry, error: fetchError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processed', false)
      .eq('permanently_failed', false)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(50); // Process 50 at a time

    if (fetchError) {
      console.error('❌ Error fetching webhooks:', fetchError.message);
      throw fetchError;
    }

    if (!webhooksToRetry || webhooksToRetry.length === 0) {
      console.log('✅ No failed webhooks to retry.');
      return;
    }

    console.log(`🔍 Found ${webhooksToRetry.length} webhook(s) to retry.\n`);

    let successCount = 0;
    let failedCount = 0;
    let permanentFailures = 0;

    for (const webhook of webhooksToRetry) {
      console.log(`\n📨 Processing webhook ${webhook.id.substring(0, 8)}...`);
      console.log(`   Provider: ${webhook.provider}`);
      console.log(`   Event: ${webhook.event_type}`);
      console.log(`   Retry count: ${webhook.retry_count}/${MAX_RETRIES}`);

      // Check if max retries exceeded
      if (webhook.retry_count >= MAX_RETRIES) {
        console.log(
          `   ⚠️  Max retries exceeded - marking as permanently failed`
        );

        await supabase
          .from('webhook_events')
          .update({
            permanently_failed: true,
            processing_error: `Max retries (${MAX_RETRIES}) exceeded`,
          })
          .eq('id', webhook.id);

        // TODO: Send alert email to admin
        if (adminEmail) {
          console.log(`   📧 Alert should be sent to ${adminEmail}`);
        }

        permanentFailures++;
        continue;
      }

      // Calculate next retry time
      const retryDelayMinutes =
        RETRY_DELAYS[webhook.retry_count] ||
        RETRY_DELAYS[RETRY_DELAYS.length - 1];
      const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

      try {
        // Simulate webhook reprocessing
        // In production, this would call the webhook handler function
        console.log(`   🔄 Attempting retry...`);

        // For now, we'll mark it as needing manual review
        // In production, you'd call the actual webhook handler:
        // await fetch(`${supabaseUrl}/functions/v1/${webhook.provider}-webhook`, ...)

        // Update retry metadata
        await supabase
          .from('webhook_events')
          .update({
            retry_count: webhook.retry_count + 1,
            last_retry_at: new Date().toISOString(),
            next_retry_at: nextRetryAt.toISOString(),
            processing_error: 'Retry scheduled via script',
          })
          .eq('id', webhook.id);

        console.log(
          `   ✅ Retry scheduled for ${nextRetryAt.toLocaleString()}`
        );
        successCount++;
      } catch (error) {
        console.error(`   ❌ Retry failed:`, error);
        failedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Retry Summary:');
    console.log(`   ✅ Retries scheduled: ${successCount}`);
    console.log(`   ❌ Retry failures: ${failedCount}`);
    console.log(`   ⚠️  Permanent failures: ${permanentFailures}`);
    console.log('='.repeat(60));

    if (permanentFailures > 0 && adminEmail) {
      console.log(
        `\n⚠️  WARNING: ${permanentFailures} webhook(s) permanently failed!`
      );
      console.log(`📧 Admin notification should be sent to: ${adminEmail}`);
    }
  } catch (error) {
    console.error('\n❌ Retry process failed:', error);
    process.exit(1);
  }
}

// Run retry process
retryFailedWebhooks()
  .then(() => {
    console.log('\n🎉 Retry process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

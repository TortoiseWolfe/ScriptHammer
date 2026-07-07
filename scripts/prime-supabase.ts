#!/usr/bin/env tsx
/**
 * Supabase Priming Script
 *
 * Wakes up Supabase Cloud instance after auto-pause (free tier pauses after 1 week of inactivity).
 * First request after pause takes 10-30 seconds as the database wakes up.
 *
 * Usage: pnpm run prime
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function primeSupabase() {
  // Validate environment variables
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    console.error(
      '   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
    console.error('   Check your .env file');
    process.exit(1);
  }

  console.log('🔄 Priming Supabase cloud instance...');
  console.log(`   URL: ${supabaseUrl}`);

  const start = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Execute actual database query to wake up instance
    // Using a simple count query on user_profiles (lightweight)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    const duration = Date.now() - start;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Interpret the duration
    if (duration > 5000) {
      console.log(
        `✅ Supabase ready (${duration}ms - instance was paused, now awake)`
      );
    } else {
      console.log(
        `✅ Supabase ready (${duration}ms - instance was already active)`
      );
    }

    console.log('   Subsequent requests should be fast (<500ms)');
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Failed to prime Supabase (${duration}ms)`);

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    } else {
      console.error(`   Error: ${String(error)}`);
    }

    console.error('\n   Troubleshooting:');
    console.error('   1. Check your internet connection');
    console.error('   2. Verify .env file has correct Supabase credentials');
    console.error(
      '   3. Check Supabase project status at https://supabase.com/dashboard'
    );
    console.error(
      '   4. Free tier projects pause after 1 week - this wake-up can take 30+ seconds'
    );

    process.exit(1);
  }
}

// Run the priming function
primeSupabase();

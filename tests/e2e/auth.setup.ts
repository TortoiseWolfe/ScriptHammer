/**
 * Auth Setup - Creates shared authenticated session for E2E tests
 *
 * This runs ONCE before all tests and saves authenticated browser state
 * INCLUDING encryption keys for messaging. Tests reuse this state instead
 * of logging in repeatedly, which:
 * - Eliminates Supabase rate-limiting from concurrent sign-in attempts
 * - Speeds up test execution across shards
 * - Ensures messaging encryption keys exist in the database
 *
 * Playwright pattern: https://playwright.dev/docs/auth
 */

import { test as setup, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  performSignIn,
  ensureEncryptionKeys,
  getUserByEmail,
  getAdminClient,
} from './utils/test-user-factory';
import { KeyDerivationService } from '@/lib/messaging/key-derivation';

const AUTH_FILE = 'tests/e2e/fixtures/storage-state-auth.json';

// Allow extra time for static page hydration + encryption setup
setup.setTimeout(120000);

setup('authenticate shared test user', async ({ page }) => {
  // Always run fresh — never use cached auth state. Cached state from
  // previous runs may lack encryption keys, causing all messaging tests
  // to redirect to /messages/setup and fail.

  const email = process.env.TEST_USER_PRIMARY_EMAIL;
  const password = process.env.TEST_USER_PRIMARY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_USER_PRIMARY_EMAIL and TEST_USER_PRIMARY_PASSWORD must be set'
    );
  }

  console.log(`Authenticating as: ${email}`);

  // Navigate to sign-in
  await page.goto('/sign-in');
  await page.waitForLoadState('domcontentloaded');

  // If already redirected away from sign-in, navigate back
  if (!page.url().includes('/sign-in')) {
    await page.goto('/sign-in');
    await page.waitForLoadState('domcontentloaded');
  }

  // Dismiss cookie banner before signing in
  await dismissCookieBanner(page);

  // Sign in using the existing helper
  const result = await performSignIn(page, email, password, { timeout: 30000 });

  if (!result.success) {
    // Take screenshot for debugging
    await page
      .screenshot({ path: 'test-results/auth-setup-failure.png' })
      .catch(() => {});
    throw new Error(
      `Auth setup sign-in failed: ${result.error}. Check test-results/auth-setup-failure.png`
    );
  }

  // Verify authenticated state
  console.log('✓ Sign-in successful, verifying auth state...');
  await expect(page).not.toHaveURL(/\/sign-in/);

  // ────────────────────────────────────────────────────────────────────────
  // CLEAN SLATE: Delete ALL messaging state for test users.
  // On CI, the auth-setup JOB does this ONCE before shards start. Running
  // it per-shard causes 6 concurrent nuclear cleanups that race and delete
  // each other's freshly created keys/connections/conversations.
  // Locally (single process), cleanup is safe and necessary.
  // ────────────────────────────────────────────────────────────────────────
  const adminClient = getAdminClient();
  // Run cleanup when: locally (!CI) OR in the dedicated auth-setup CI job (AUTH_SETUP_JOB).
  // Skip in per-shard runs (CI=true, AUTH_SETUP_JOB absent) to avoid 6 concurrent cleanups.
  const shouldDoFullSetup =
    !process.env.CI || process.env.AUTH_SETUP_JOB === 'true';
  if (adminClient && shouldDoFullSetup) {
    console.log('Cleaning up stale messaging state from previous runs...');
    const allTestEmails = [
      email,
      process.env.TEST_USER_SECONDARY_EMAIL,
      process.env.TEST_USER_TERTIARY_EMAIL,
    ].filter(Boolean) as string[];

    const userIds: string[] = [];
    for (const testEmail of allTestEmails) {
      const u = await getUserByEmail(testEmail);
      if (u) userIds.push(u.id);
    }

    if (userIds.length > 0) {
      const orFilter = userIds.map((id) => `sender_id.eq.${id}`).join(',');
      const participantFilter = userIds
        .flatMap((id) => [
          `participant_1_id.eq.${id}`,
          `participant_2_id.eq.${id}`,
        ])
        .join(',');
      const connectionFilter = userIds
        .flatMap((id) => [`requester_id.eq.${id}`, `addressee_id.eq.${id}`])
        .join(',');
      const userFilter = userIds.map((id) => `user_id.eq.${id}`).join(',');

      await adminClient.from('messages').delete().or(orFilter);
      await adminClient.from('conversations').delete().or(participantFilter);
      await adminClient.from('user_connections').delete().or(connectionFilter);
      // DO NOT delete user_encryption_keys — they must persist across CI runs.
      // Deleting and recreating with a new random salt every run was the root
      // cause of all ECDH decryption failures (key mismatch between shards).
      console.log(
        `✓ Cleaned up messaging state for ${userIds.length} test users (keys preserved)`
      );
    }
  } else {
    console.log(
      '⏭ Skipping nuclear cleanup (per-shard run, auth-setup job did it)'
    );
  }

  // Set up encryption keys for ALL test users via admin API, then inject
  // the primary user's key cache into localStorage so storageState captures it.
  // CRITICAL: Only create keys in the auth-setup JOB (shouldDoFullSetup=true).
  // Per-shard runs must NOT recreate keys — each shard would overwrite the DB
  // with a new random salt, but the storageState still has the original salt
  // from the auth-setup job. This salt mismatch breaks ECDH decryption.
  if (shouldDoFullSetup) {
    console.log('Setting up encryption keys for messaging...');

    // Step 1: Create matching DB keys for the primary user
    const primaryOk = await ensureEncryptionKeys(email, password);
    if (primaryOk) {
      console.log('✓ Primary user encryption keys ready in DB');
    } else {
      console.log('⚠ Could not create primary user encryption keys');
    }
  } else {
    console.log('⏭ Skipping key creation (auth-setup job did it)');
  }

  // Step 2: Inject the primary user's derived keys into localStorage
  // so storageState captures them. Tests that load this state will have
  // sh_keys_{userId} → restoreKeysFromCache() → memory + IndexedDB.
  const primaryUser = await getUserByEmail(email);
  if (primaryUser) {
    const admin = getAdminClient();
    if (admin) {
      // Read the salt from the DB (ensureEncryptionKeys just created it)
      const { data: keyRow } = await admin
        .from('user_encryption_keys')
        .select('encryption_salt')
        .eq('user_id', primaryUser.id)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (keyRow?.encryption_salt) {
        const kds = new KeyDerivationService();
        // encryption_salt is stored as base64 string in DB, but
        // deriveKeyPair expects Uint8Array. Decode it.
        const saltBytes = Uint8Array.from(atob(keyRow.encryption_salt), (c) =>
          c.charCodeAt(0)
        );
        const keyPair = await kds.deriveKeyPair({
          password,
          salt: saltBytes,
        });
        // Export to JWK for localStorage cache format
        const privateJwk = await crypto.subtle.exportKey(
          'jwk',
          keyPair.privateKey
        );
        const publicJwk = await crypto.subtle.exportKey(
          'jwk',
          keyPair.publicKey
        );
        const cacheValue = JSON.stringify({
          privateKeyJwk: privateJwk,
          publicKeyJwk: publicJwk,
          publicKeyJwkOriginal: keyPair.publicKeyJwk,
          salt: keyPair.salt,
        });
        // Inject into browser localStorage via page.evaluate
        await page.evaluate(
          ({ key, value }) => localStorage.setItem(key, value),
          { key: `sh_keys_${primaryUser.id}`, value: cacheValue }
        );
        console.log(
          `✓ Injected sh_keys_${primaryUser.id.slice(0, 8)} into localStorage`
        );
      }
    }
  }

  // Log localStorage keys before saving (diagnostic: are auth tokens present?)
  const lsKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys before storageState save:', lsKeys);
  const authKey = lsKeys.find(
    (k) => k.includes('auth-token') || k.includes('sb-')
  );
  if (authKey) {
    console.log(`✓ Supabase auth token found: ${authKey}`);
  } else {
    console.error('✗ NO Supabase auth token in localStorage!');
  }

  // Set E2E flag in localStorage for test-specific behavior detection
  // (cross-tab sign-out suppression in AuthContext).
  await page.evaluate(() => localStorage.setItem('playwright_e2e', 'true'));

  // Save authenticated browser state (localStorage + cookies).
  // Now includes sh_keys_{userId} and playwright_e2e flag so tests can
  // restore keys from cache without needing ReAuthModal or Argon2id.
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✓ Auth state saved to ${AUTH_FILE}`);

  // ────────────────────────────────────────────────────────────────────────
  // Create encryption keys, connections, conversations for all test users.
  // On CI, the auth-setup JOB does this ONCE before shards start.
  // Per-shard creation races with other shards and causes duplicate key
  // violations, missing state, and connection conflicts.
  // ────────────────────────────────────────────────────────────────────────
  if (!shouldDoFullSetup) {
    console.log(
      '⏭ Skipping key/connection/conversation creation (auth-setup job did it)'
    );
    console.log('✓ Centralized test data setup complete');
  }

  if (shouldDoFullSetup) {
    const additionalUsers = [
      {
        email: process.env.TEST_USER_SECONDARY_EMAIL,
        password: process.env.TEST_USER_SECONDARY_PASSWORD,
      },
      {
        email: process.env.TEST_USER_TERTIARY_EMAIL,
        password: process.env.TEST_USER_TERTIARY_PASSWORD,
      },
    ].filter(
      (u): u is { email: string; password: string } => !!u.email && !!u.password
    );

    for (const { email: userEmail, password: userPwd } of additionalUsers) {
      console.log(`Setting up encryption keys for ${userEmail}...`);
      const ok = await ensureEncryptionKeys(userEmail, userPwd);
      if (!ok) {
        console.log(`⚠ Could not set up keys for ${userEmail}`);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // CENTRALIZED SETUP: Create display_names, connections, and conversations
    // for ALL test users. Individual test files previously raced to create
    // these in their own beforeAll hooks (with 2 parallel workers per shard),
    // causing duplicate key violations, missing state, and empty lists.
    // ────────────────────────────────────────────────────────────────────────
    if (adminClient) {
      // Collect user IDs for all test users
      const allTestUsers = [
        { email: process.env.TEST_USER_PRIMARY_EMAIL, label: 'PRIMARY' },
        { email: process.env.TEST_USER_SECONDARY_EMAIL, label: 'SECONDARY' },
        { email: process.env.TEST_USER_TERTIARY_EMAIL, label: 'TERTIARY' },
      ].filter((u): u is { email: string; label: string } => !!u.email);

      const userMap: Record<string, { id: string; email: string }> = {};
      for (const { email: testEmail, label } of allTestUsers) {
        const u = await getUserByEmail(testEmail);
        if (u) {
          userMap[label] = { id: u.id, email: testEmail };
        }
      }

      // Step A: Set display_names on user_profiles (required for UserSearch)
      for (const { email: testEmail, label } of allTestUsers) {
        const u = userMap[label];
        if (!u) continue;
        const displayName = testEmail.split('@')[0];
        const { error: profileError } = await adminClient
          .from('user_profiles')
          .update({ display_name: displayName })
          .eq('id', u.id);
        if (profileError) {
          console.log(
            `⚠ Could not set display_name for ${label}: ${profileError.message}`
          );
        }
      }
      console.log('✓ Display names set for all test users');

      // Step B: Create accepted connections between test user pairs
      const connectionPairs: [string, string][] = [];
      if (userMap.PRIMARY && userMap.TERTIARY) {
        connectionPairs.push(['PRIMARY', 'TERTIARY']);
      }
      if (userMap.PRIMARY && userMap.SECONDARY) {
        connectionPairs.push(['PRIMARY', 'SECONDARY']);
      }

      for (const [labelA, labelB] of connectionPairs) {
        const uA = userMap[labelA];
        const uB = userMap[labelB];
        if (!uA || !uB) continue;

        const { data: existing } = await adminClient
          .from('user_connections')
          .select('id, status')
          .or(
            `and(requester_id.eq.${uA.id},addressee_id.eq.${uB.id}),and(requester_id.eq.${uB.id},addressee_id.eq.${uA.id})`
          )
          .maybeSingle();

        if (!existing) {
          const { error } = await adminClient.from('user_connections').insert({
            requester_id: uA.id,
            addressee_id: uB.id,
            status: 'accepted',
          });
          if (error) {
            console.log(
              `⚠ Failed to create ${labelA}↔${labelB} connection: ${error.message}`
            );
          } else {
            console.log(`✓ Connection created: ${labelA}↔${labelB}`);
          }
        } else if (existing.status !== 'accepted') {
          await adminClient
            .from('user_connections')
            .update({ status: 'accepted' })
            .eq('id', existing.id);
          console.log(`✓ Connection updated to accepted: ${labelA}↔${labelB}`);
        } else {
          console.log(`✓ Connection already exists: ${labelA}↔${labelB}`);
        }
      }

      // Step C: Create conversation between PRIMARY↔TERTIARY
      if (userMap.PRIMARY && userMap.TERTIARY) {
        const [p1, p2] =
          userMap.PRIMARY.id < userMap.TERTIARY.id
            ? [userMap.PRIMARY.id, userMap.TERTIARY.id]
            : [userMap.TERTIARY.id, userMap.PRIMARY.id];

        const { data: existingConv } = await adminClient
          .from('conversations')
          .select('id')
          .eq('participant_1_id', p1)
          .eq('participant_2_id', p2)
          .maybeSingle();

        if (!existingConv) {
          const { data: newConv, error: convError } = await adminClient
            .from('conversations')
            .insert({ participant_1_id: p1, participant_2_id: p2 })
            .select('id')
            .single();
          if (convError) {
            console.log(
              `⚠ Failed to create conversation: ${convError.message}`
            );
          } else {
            console.log(`✓ Conversation created: ${newConv.id}`);
          }
        } else {
          console.log(`✓ Conversation already exists: ${existingConv.id}`);
        }
      }

      console.log('✓ Centralized test data setup complete');
    }
  } // end if (!process.env.CI)
});

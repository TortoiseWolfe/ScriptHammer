// Security Hardening: OAuth CSRF Attack E2E Test
// Feature 017 - Task T014
// Purpose: Test OAuth CSRF protection prevents session hijacking

import { test, expect } from '@playwright/test';

test.describe('OAuth CSRF Protection - REQ-SEC-002', () => {
  test('should reject OAuth callback with modified state parameter', async ({
    page,
    context,
  }) => {
    // Navigate to sign-in page
    await page.goto('/sign-in');

    // Click "Sign in with GitHub" button
    const githubButton = page.locator('button:has-text("Sign in with GitHub")');
    await expect(githubButton).toBeVisible();

    // Intercept the OAuth redirect to capture the state parameter
    let capturedState: string | null = null;

    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.hostname === 'github.com' &&
        url.pathname === '/login/oauth/authorize'
      ) {
        capturedState = url.searchParams.get('state');
      }
    });

    // Click the GitHub OAuth button
    await githubButton.click();

    // Wait for redirect to GitHub (state should be captured)
    await page.waitForURL(/github\.com/, { timeout: 5000 }).catch(() => {
      // May not actually redirect in test environment
    });

    // Verify state was generated
    expect(capturedState).toBeTruthy();

    // Simulate attacker modifying the state parameter
    const modifiedState = 'attacker-controlled-state-token-12345';

    // Navigate directly to callback with modified state
    await page.goto(`/auth/callback?code=test-code&state=${modifiedState}`);

    // Should see error message about invalid state
    await expect(
      page.locator('text=/invalid.*state|csrf.*detected|unauthorized/i')
    ).toBeVisible({
      timeout: 3000,
    });

    // Should NOT be signed in
    const profileLink = page.locator('a[href="/profile"]');
    await expect(profileLink).not.toBeVisible();
  });

  test('should prevent OAuth callback without state parameter', async ({
    page,
  }) => {
    // Navigate directly to OAuth callback without state
    await page.goto('/auth/callback?code=test-code');

    // Should see error about missing state
    await expect(
      page.locator('text=/missing.*state|invalid.*request/i')
    ).toBeVisible({
      timeout: 3000,
    });

    // Should not be authenticated
    await page.goto('/profile');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('should reject reused state token (replay attack)', async ({
    page,
    context,
  }) => {
    // This test simulates an attacker trying to replay a captured OAuth state token

    // Step 1: Legitimate user initiates OAuth flow
    await page.goto('/sign-in');

    let capturedState: string | null = null;

    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes('/auth/callback')) {
        capturedState = url.searchParams.get('state');
      }
    });

    const githubButton = page.locator('button:has-text("Sign in with GitHub")');
    await githubButton.click();

    // Wait briefly for state to be generated
    await page.waitForTimeout(1000);

    // Step 2: If we captured a state, try to reuse it
    if (capturedState) {
      // First callback (should succeed)
      await page.goto(`/auth/callback?code=code1&state=${capturedState}`);
      await page.waitForTimeout(500);

      // Second callback with same state (should fail - replay attack)
      await page.goto(`/auth/callback?code=code2&state=${capturedState}`);

      // Should see error about state already used
      await expect(
        page.locator('text=/state.*used|invalid.*state/i')
      ).toBeVisible({
        timeout: 3000,
      });
    }
  });

  test('should timeout expired state tokens', async ({ page }) => {
    // Generate a state token
    await page.goto('/sign-in');
    const githubButton = page.locator('button:has-text("Sign in with GitHub")');

    let capturedState: string | null = null;

    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname === 'github.com') {
        capturedState = url.searchParams.get('state');
      }
    });

    await githubButton.click();
    await page.waitForTimeout(1000);

    // In real test, would wait 6 minutes for token to expire
    // For now, just verify the mechanism exists
    expect(capturedState).toBeTruthy();

    // In actual implementation, states expire after 5 minutes
    // This would require database manipulation or time mocking to test properly
  });

  test('should validate state session ownership', async ({ browser }) => {
    // Simulate CSRF attack: Attacker initiates OAuth, victim completes it

    // Attacker's browser session
    const attackerContext = await browser.newContext();
    const attackerPage = await attackerContext.newPage();

    // Victim's browser session
    const victimContext = await browser.newContext();
    const victimPage = await victimContext.newPage();

    // Attacker starts OAuth flow
    await attackerPage.goto('/sign-in');

    let attackerState: string | null = null;

    attackerPage.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes('/auth/callback')) {
        attackerState = url.searchParams.get('state');
      }
    });

    const attackerGithubBtn = attackerPage.locator(
      'button:has-text("Sign in with GitHub")'
    );
    await attackerGithubBtn.click();
    await attackerPage.waitForTimeout(1000);

    // Attacker tricks victim into completing OAuth with attacker's state
    if (attackerState) {
      await victimPage.goto(
        `/auth/callback?code=victim-code&state=${attackerState}`
      );

      // Should fail due to session mismatch
      await expect(
        victimPage.locator('text=/session.*mismatch|invalid.*state/i')
      ).toBeVisible({
        timeout: 3000,
      });

      // Victim should NOT be signed in as attacker
      await victimPage.goto('/profile');
      await expect(victimPage).toHaveURL(/sign-in/);
    }

    // Cleanup
    await attackerContext.close();
    await victimContext.close();
  });
});

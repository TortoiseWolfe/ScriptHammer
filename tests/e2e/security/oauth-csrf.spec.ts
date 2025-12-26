// Security Hardening: OAuth CSRF Attack E2E Test
// Feature 017 - Task T014
// Purpose: Test OAuth CSRF protection prevents session hijacking
//
// Supabase uses PKCE (Proof Key for Code Exchange) for OAuth CSRF protection.
// These tests verify the OAuth flow includes proper security parameters.

import { test, expect, Page } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Clicks OAuth button and captures the OAuth authorize request URL.
 * This captures the initial request with all OAuth parameters before any redirects.
 */
async function clickOAuthAndCaptureRequest(
  page: Page,
  buttonSelector: RegExp
): Promise<{ oauthUrl: string; finalUrl: string }> {
  let capturedOAuthUrl = '';

  // Listen for requests to OAuth providers
  page.on('request', (request) => {
    const url = request.url();
    // Capture the OAuth authorization URL (has the state parameter)
    if (
      url.includes('github.com/login/oauth/authorize') ||
      url.includes('accounts.google.com/o/oauth2')
    ) {
      capturedOAuthUrl = url;
    }
  });

  // Click the OAuth button
  const button = page.getByRole('button', { name: buttonSelector });
  await button.click();

  // Wait for navigation to OAuth provider
  await page.waitForURL(
    (url) => {
      const hostname = url.hostname;
      return (
        hostname.includes('github.com') ||
        hostname.includes('google.com') ||
        hostname.includes('supabase.co')
      );
    },
    { timeout: 15000 }
  );

  return {
    oauthUrl: capturedOAuthUrl,
    finalUrl: page.url(),
  };
}

test.describe('OAuth CSRF Protection - REQ-SEC-002', () => {
  test('OAuth buttons should be visible and enabled on sign-in page', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Verify GitHub OAuth button
    const githubButton = page.getByRole('button', {
      name: /Continue with GitHub/i,
    });
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toBeEnabled();

    // Verify Google OAuth button
    const googleButton = page.getByRole('button', {
      name: /Continue with Google/i,
    });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
  });

  test('OAuth redirect should include state parameter for CSRF protection', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Capture OAuth request URL
    const { oauthUrl, finalUrl } = await clickOAuthAndCaptureRequest(
      page,
      /Continue with GitHub/i
    );

    // Verify we captured the OAuth URL and reached GitHub
    expect(oauthUrl).toBeTruthy();
    expect(finalUrl).toMatch(/github\.com/);

    // Parse URL and check for state parameter
    const url = new URL(oauthUrl);
    const stateParam = url.searchParams.get('state');

    // State parameter must exist for CSRF protection
    expect(stateParam).toBeTruthy();
    expect(stateParam!.length).toBeGreaterThan(10);
  });

  test('OAuth state parameter should be unique per request', async ({
    browser,
  }) => {
    // Create two separate browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Navigate both to sign-in
    await page1.goto('/sign-in');
    await dismissCookieBanner(page1);

    await page2.goto('/sign-in');
    await dismissCookieBanner(page2);

    // Get OAuth URLs from both contexts sequentially
    const result1 = await clickOAuthAndCaptureRequest(
      page1,
      /Continue with GitHub/i
    );
    const result2 = await clickOAuthAndCaptureRequest(
      page2,
      /Continue with GitHub/i
    );

    // Parse state parameters from OAuth URLs
    const state1 = new URL(result1.oauthUrl).searchParams.get('state');
    const state2 = new URL(result2.oauthUrl).searchParams.get('state');

    // State tokens should exist
    expect(state1).toBeTruthy();
    expect(state2).toBeTruthy();

    // State tokens should be different (unique per session)
    expect(state1).not.toEqual(state2);

    await context1.close();
    await context2.close();
  });

  test('OAuth redirect should go to correct provider', async ({ page }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Test GitHub OAuth redirect
    const { oauthUrl: githubOAuthUrl, finalUrl: githubFinalUrl } =
      await clickOAuthAndCaptureRequest(page, /Continue with GitHub/i);
    expect(githubOAuthUrl).toMatch(/github\.com/);
    expect(githubFinalUrl).toMatch(/github\.com/);

    // Navigate back for Google test
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Test Google OAuth redirect
    const { finalUrl: googleFinalUrl } = await clickOAuthAndCaptureRequest(
      page,
      /Continue with Google/i
    );
    // Google OAuth may go through accounts.google.com or supabase.co
    expect(googleFinalUrl).toMatch(/google\.com|supabase\.co/);
  });

  test('OAuth flow should include required OAuth parameters', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Get the OAuth URL
    const { oauthUrl } = await clickOAuthAndCaptureRequest(
      page,
      /Continue with GitHub/i
    );
    const url = new URL(oauthUrl);

    // Verify required OAuth parameters
    expect(url.searchParams.get('client_id')).toBeTruthy();
    expect(url.searchParams.get('response_type')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('redirect_uri')).toBeTruthy();
    expect(url.searchParams.get('scope')).toBeTruthy();
  });

  test('different browser sessions should have isolated OAuth state', async ({
    browser,
  }) => {
    // Simulate attacker and victim in separate browser contexts
    const attackerContext = await browser.newContext();
    const victimContext = await browser.newContext();

    const attackerPage = await attackerContext.newPage();
    const victimPage = await victimContext.newPage();

    // Attacker initiates OAuth
    await attackerPage.goto('/sign-in');
    await dismissCookieBanner(attackerPage);
    const { oauthUrl: attackerOAuthUrl } = await clickOAuthAndCaptureRequest(
      attackerPage,
      /Continue with GitHub/i
    );
    const attackerState = new URL(attackerOAuthUrl).searchParams.get('state');

    // Victim initiates their own OAuth
    await victimPage.goto('/sign-in');
    await dismissCookieBanner(victimPage);
    const { oauthUrl: victimOAuthUrl } = await clickOAuthAndCaptureRequest(
      victimPage,
      /Continue with GitHub/i
    );
    const victimState = new URL(victimOAuthUrl).searchParams.get('state');

    // States must be different - attacker cannot predict victim's state
    expect(attackerState).toBeTruthy();
    expect(victimState).toBeTruthy();
    expect(attackerState).not.toEqual(victimState);

    await attackerContext.close();
    await victimContext.close();
  });

  test('OAuth redirect_uri should point to Supabase callback', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    const { oauthUrl } = await clickOAuthAndCaptureRequest(
      page,
      /Continue with GitHub/i
    );
    const url = new URL(oauthUrl);

    // Should have redirect_uri pointing back to Supabase
    const redirectUri = url.searchParams.get('redirect_uri');
    expect(redirectUri).toBeTruthy();
    expect(redirectUri).toMatch(/supabase\.co/);

    // Should use authorization code flow
    const responseType = url.searchParams.get('response_type');
    expect(responseType).toEqual('code');

    // Should have client_id
    const clientId = url.searchParams.get('client_id');
    expect(clientId).toBeTruthy();
  });
});

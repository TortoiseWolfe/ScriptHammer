# Authentication Setup Guide (PRP-016)

Complete guide for configuring Supabase authentication with email/password and OAuth providers.

## Prerequisites

- Supabase project created: `vswxgxbjodpgwfgsjrhq`
- Environment variables configured in `.env.local`

## Part 1: Database Setup

### 1.1 Run SQL Migrations

**Step 1:** Navigate to Supabase SQL Editor

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/sql

**Step 2:** Drop all existing tables (clean slate)

- Open file: `supabase/migrations/999_drop_all_tables.sql`
- Copy **entire file contents**
- Paste into SQL Editor
- Click **"RUN"**
- Expected output: `Success. No rows returned`

**Step 3:** Create all tables (payment + authentication)

- Open file: `supabase/migrations/complete_setup.sql`
- Copy **entire file contents**
- Paste into SQL Editor
- Click **"RUN"**
- Expected output: `Success. No rows returned`

**Step 4:** Verify tables were created

- Navigate to: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/editor
- You should see these tables:
  - `payment_intents` ← Payment system
  - `payment_results` ← Payment system
  - `subscriptions` ← Payment system
  - `webhook_events` ← Payment system
  - `payment_provider_config` ← Payment system
  - `user_profiles` ← Authentication
  - `auth_audit_logs` ← Authentication

**IMPORTANT:** If you see errors about the trigger failing, the `complete_setup.sql` file includes the fix with `SECURITY DEFINER` to bypass RLS.

## Part 2: Enable Email/Password Authentication

### 2.1 Enable Email Provider

**Step 1:** Navigate to Auth Providers

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/providers

**Step 2:** Find "Email" in the provider list

- Scroll down to find the **"Email"** provider (should be near the top)

**Step 3:** Enable the provider

- Click on **"Email"** to expand settings
- Toggle **"Enable Email provider"** to **ON**

**Step 4:** Configure email settings (optional)

- **Confirm email:** ON (recommended - users must verify email before sign-in)
- **Secure email change:** ON (recommended - requires confirmation for email changes)
- **Double confirm email changes:** OFF (unless you want extra security)

**Step 5:** Save changes

- Click **"Save"** at the bottom of the page

### 2.2 Configure Email Templates (Optional)

**Step 1:** Navigate to Email Templates

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/templates

**Step 2:** Customize templates

- **Confirm signup:** Email sent when user signs up
- **Magic Link:** For passwordless login
- **Change Email Address:** Confirmation email for email changes
- **Reset Password:** Password reset emails

**Default templates work fine** - customize only if needed for branding.

## Part 3: Enable GitHub OAuth (Optional)

### 3.1 Create GitHub OAuth Application

**Step 1:** Go to GitHub Developer Settings

- **URL:** https://github.com/settings/developers
- Click **"OAuth Apps"** in left sidebar
- Click **"New OAuth App"** button

**Step 2:** Fill in application details

| Field                          | Value                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| **Application name**           | `ScriptHammer` (or your preferred name)                      |
| **Homepage URL**               | `http://localhost:3000` (development) or your production URL |
| **Application description**    | (Optional) "Next.js template with authentication"            |
| **Authorization callback URL** | `https://vswxgxbjodpgwfgsjrhq.supabase.co/auth/v1/callback`  |

**Step 3:** Register application

- Click **"Register application"**
- You'll be redirected to the app details page

**Step 4:** Copy credentials

- Copy the **Client ID** (visible immediately)
- Click **"Generate a new client secret"**
- Copy the **Client Secret** (shown once - save it now!)

### 3.2 Configure GitHub in Supabase

**Step 1:** Navigate to Auth Providers

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/providers

**Step 2:** Find and enable GitHub

- Scroll to **"GitHub"** provider
- Click to expand settings
- Toggle **"Enable GitHub provider"** to **ON**

**Step 3:** Paste GitHub credentials

- **Client ID:** Paste from GitHub OAuth app (Step 3.1.4)
- **Client Secret:** Paste from GitHub OAuth app (Step 3.1.4)

**Step 4:** Save changes

- Click **"Save"** at the bottom

**Step 5:** Verify callback URL matches

- Ensure the callback URL in Supabase matches what you entered in GitHub:
  - `https://vswxgxbjodpgwfgsjrhq.supabase.co/auth/v1/callback`

## Part 4: Enable Google OAuth (Optional)

### 4.1 Create Google OAuth Application

**Step 1:** Go to Google Cloud Console

- **URL:** https://console.cloud.google.com/apis/credentials
- Select your project or create a new one

**Step 2:** Create OAuth 2.0 Client ID

- Click **"+ CREATE CREDENTIALS"**
- Select **"OAuth client ID"**
- If prompted, configure the OAuth consent screen first

**Step 3:** Configure OAuth consent screen (if needed)

- **User Type:** External (for public apps)
- **App name:** ScriptHammer
- **User support email:** Your email
- **Developer contact information:** Your email
- Click **"Save and Continue"**
- Skip **Scopes** (click "Save and Continue")
- Skip **Test users** (click "Save and Continue")

**Step 4:** Create OAuth Client ID

- **Application type:** Web application
- **Name:** ScriptHammer
- **Authorized redirect URIs:** Click **"+ ADD URI"**
  - Add: `https://vswxgxbjodpgwfgsjrhq.supabase.co/auth/v1/callback`
- Click **"CREATE"**

**Step 5:** Copy credentials

- Copy the **Client ID**
- Copy the **Client Secret**

### 4.2 Configure Google in Supabase

**Step 1:** Navigate to Auth Providers

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/providers

**Step 2:** Find and enable Google

- Scroll to **"Google"** provider
- Click to expand settings
- Toggle **"Enable Google provider"** to **ON**

**Step 3:** Paste Google credentials

- **Client ID:** Paste from Google Cloud Console (Step 4.1.5)
- **Client Secret:** Paste from Google Cloud Console (Step 4.1.5)

**Step 4:** Save changes

- Click **"Save"** at the bottom

## Part 5: Configure Authentication Settings

### 5.1 Site URL Configuration

**Step 1:** Navigate to Auth settings

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/url-configuration

**Step 2:** Set Site URL

- **Development:** `http://localhost:3000`
- **Production:** Your deployed URL (e.g., `https://scripthammer.github.io/ScriptHammer`)

**Step 3:** Add Redirect URLs

- Click **"Add redirect URL"** for each environment:
  - `http://localhost:3000/**` (development)
  - `https://scripthammer.github.io/ScriptHammer/**` (production)

### 5.2 Email Auth Settings

**Step 1:** Navigate to Auth settings

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/settings/auth

**Step 2:** Configure security settings

| Setting                               | Recommended Value | Reason                                      |
| ------------------------------------- | ----------------- | ------------------------------------------- |
| **Enable email confirmations**        | ON                | Verify user owns the email                  |
| **Enable email change confirmations** | ON                | Prevent account takeover                    |
| **Secure email change**               | ON                | Require current password to change email    |
| **Allow users without an email**      | OFF               | Email required for notifications & recovery |

**Step 3:** Session settings (optional)

- **JWT expiry:** 3600 seconds (1 hour) - default is fine
- **Refresh token rotation:** ON - prevents token theft

## Part 6: Test Authentication

### 6.1 Test Email/Password Sign-Up

**Step 1:** Start development server

```bash
docker compose exec scripthammer pnpm run dev
```

**Step 2:** Navigate to sign-up page

- **URL:** http://localhost:3000/sign-up

**Step 3:** Create test account

- Enter email: `test@example.com`
- Enter password: `TestPassword123!`
- Click **"Sign Up"**

**Step 4:** Check email for verification

- Check inbox for confirmation email from Supabase
- Click the verification link
- You should be redirected to the app

**Step 5:** Verify user was created

- Navigate to: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/users
- You should see `test@example.com` in the user list

### 6.2 Test OAuth Sign-In (GitHub/Google)

**Step 1:** Navigate to sign-in page

- **URL:** http://localhost:3000/sign-in

**Step 2:** Click OAuth button

- Click **"Sign in with GitHub"** or **"Sign in with Google"**

**Step 3:** Authorize application

- You'll be redirected to GitHub/Google
- Click **"Authorize"** to grant access

**Step 4:** Verify redirect

- You should be redirected back to: http://localhost:3000/profile
- You should see your profile information

**Step 5:** Check Supabase users

- Navigate to: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/users
- You should see your GitHub/Google account in the user list

## Part 7: Environment Variables

### 7.1 Required Environment Variables

Create or update `.env.local` in project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://vswxgxbjodpgwfgsjrhq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Get anon key from: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/settings/api
```

### 7.2 Get Supabase API Keys

**Step 1:** Navigate to API settings

- **URL:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/settings/api

**Step 2:** Copy API keys

- **Project URL:** Already in `.env.local` above
- **anon/public key:** Copy and paste into `.env.local`
- **service_role key:** DO NOT expose in client code (server-side only)

**Step 3:** Restart development server

```bash
# Exit dev server (Ctrl+C)
docker compose exec scripthammer pnpm run dev
```

## Troubleshooting

### Issue: "Unsupported provider: provider is not enabled"

**Solution:** Email/GitHub/Google provider not enabled in Supabase

- Go to: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/providers
- Enable the provider you're trying to use
- Click **"Save"**

### Issue: "Invalid redirect URL"

**Solution:** Redirect URL not whitelisted

- Go to: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/url-configuration
- Add your URL to **"Redirect URLs"**
- Format: `http://localhost:3000/**` (note the `/**` wildcard)

### Issue: "Email not confirmed"

**Solution:** User hasn't verified email

- Check email inbox for verification link
- Or disable email confirmation temporarily:
  - Go to: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/settings/auth
  - Toggle **"Enable email confirmations"** to OFF (not recommended for production)

### Issue: GitHub OAuth callback error

**Solution:** Callback URL mismatch

- Verify GitHub OAuth app callback URL matches:
  - `https://vswxgxbjodpgwfgsjrhq.supabase.co/auth/v1/callback`
- Check both GitHub app settings and Supabase provider settings

### Issue: Google OAuth "redirect_uri_mismatch"

**Solution:** Redirect URI not configured in Google Cloud

- Go to: https://console.cloud.google.com/apis/credentials
- Edit your OAuth 2.0 Client ID
- Add authorized redirect URI:
  - `https://vswxgxbjodpgwfgsjrhq.supabase.co/auth/v1/callback`

## Reference Links

### Supabase Dashboard

- **Project Home:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq
- **SQL Editor:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/sql
- **Auth Providers:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/providers
- **Auth Users:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/users
- **API Settings:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/settings/api
- **URL Configuration:** https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/auth/url-configuration

### OAuth Provider Setup

- **GitHub Developer Settings:** https://github.com/settings/developers
- **Google Cloud Console:** https://console.cloud.google.com/apis/credentials

### Supabase Documentation

- **Auth Providers Guide:** https://supabase.com/docs/guides/auth/social-login
- **Email Auth Guide:** https://supabase.com/docs/guides/auth/auth-email
- **Row Level Security:** https://supabase.com/docs/guides/auth/row-level-security

## Next Steps

After completing authentication setup:

1. **Test all auth flows** (email, GitHub, Google)
2. **Configure email templates** for branding (optional)
3. **Set up password policies** (min length, complexity)
4. **Enable MFA** for extra security (optional)
5. **Configure rate limiting** to prevent abuse
6. **Set up monitoring** for failed login attempts

---

**Documentation Version:** 1.0.0
**Last Updated:** 2025-10-05
**Related PRPs:** PRP-016 (User Authentication), PRP-015 (Payment Integration)

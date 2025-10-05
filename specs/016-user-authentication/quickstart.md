# Quickstart: User Authentication & Authorization

**Feature**: PRP-016 User Authentication
**Primary User Journey**: Sign up → Verify Email → Sign In → Access Protected Content

## Prerequisites

1. **Environment Setup**:

   ```bash
   # Copy environment variables
   cp .env.example .env

   # Add Supabase credentials
   NEXT_PUBLIC_SUPABASE_URL=https://vswxgxbjodpgwfgsjrhq.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

2. **Database Setup**:

   ```bash
   # Run migrations
   psql $DATABASE_URL < supabase/migrations/000_create_auth_tables.sql
   psql $DATABASE_URL < supabase/migrations/001_update_payment_rls.sql
   ```

3. **Start Development Server**:
   ```bash
   docker compose exec scripthammer pnpm run dev
   ```

## Test Scenario: Complete Auth Flow

### Step 1: User Registration

**Action**: Sign up with email and password

**Test Data**:

- Email: `test@example.com`
- Password: `Test1234!`

**Expected Behavior**:

1. Navigate to `/sign-up`
2. Fill in email and password
3. Click "Sign Up" button
4. See success message: "Verification email sent to test@example.com"
5. User record created in `auth.users` with `email_confirmed_at = null`
6. User profile created in `user_profiles` (via trigger)
7. Audit log entry: `event_type = 'sign_up'`

**Validation**:

```bash
# Check user exists (unverified)
psql $DATABASE_URL -c "SELECT id, email, email_confirmed_at FROM auth.users WHERE email='test@example.com';"

# Check profile created
psql $DATABASE_URL -c "SELECT id, username FROM user_profiles WHERE id=(SELECT id FROM auth.users WHERE email='test@example.com');"

# Check audit log
psql $DATABASE_URL -c "SELECT event_type, created_at FROM auth_audit_logs WHERE user_id=(SELECT id FROM auth.users WHERE email='test@example.com') ORDER BY created_at DESC;"
```

### Step 2: Email Verification

**Action**: Verify email via verification link

**Test Data**:

- Verification link sent to email (check Supabase Auth → Email Templates)
- Example: `/verify-email?token=abc123...`

**Expected Behavior**:

1. Click verification link in email
2. Redirected to `/verify-email?token=...`
3. Client calls `supabase.auth.verifyOtp({ token, type: 'signup' })`
4. `auth.users.email_confirmed_at` set to current timestamp
5. Success message: "Email verified! You can now sign in."
6. Audit log entry: `event_type = 'email_verification_complete'`

**Validation**:

```bash
# Check email confirmed
psql $DATABASE_URL -c "SELECT email_confirmed_at FROM auth.users WHERE email='test@example.com';"

# Check audit log
psql $DATABASE_URL -c "SELECT event_type FROM auth_audit_logs WHERE user_id=(SELECT id FROM auth.users WHERE email='test@example.com') AND event_type='email_verification_complete';"
```

### Step 3: Sign In

**Action**: Sign in with verified credentials

**Test Data**:

- Email: `test@example.com`
- Password: `Test1234!`
- Remember Me: checked

**Expected Behavior**:

1. Navigate to `/sign-in`
2. Enter email and password
3. Check "Remember Me" checkbox
4. Click "Sign In" button
5. Session created with 30-day expiration
6. Redirected to `/dashboard`
7. `auth.users.last_sign_in_at` updated
8. Audit log entry: `event_type = 'sign_in_success'`

**Validation**:

```bash
# Check last sign-in updated
psql $DATABASE_URL -c "SELECT last_sign_in_at FROM auth.users WHERE email='test@example.com';"

# Check session in localStorage (browser console)
localStorage.getItem('supabase.auth.token')

# Check audit log
psql $DATABASE_URL -c "SELECT event_type, event_data->>'remember_me' as remember_me FROM auth_audit_logs WHERE user_id=(SELECT id FROM auth.users WHERE email='test@example.com') AND event_type='sign_in_success' ORDER BY created_at DESC LIMIT 1;"
```

### Step 4: Access Protected Content

**Action**: Access payment demo page (protected route)

**Expected Behavior**:

1. Navigate to `/payment-demo`
2. Middleware validates session
3. Session valid → Page renders
4. Payment history shows only user's transactions
5. RLS policy enforces: `auth.uid() = template_user_id`

**Validation**:

```bash
# Check payment access (should only show user's payments)
psql $DATABASE_URL -c "SELECT id, amount, customer_email FROM payment_intents WHERE template_user_id=(SELECT id FROM auth.users WHERE email='test@example.com');"

# Test RLS policy (should fail if accessing other user's data)
psql $DATABASE_URL -c "SET request.jwt.claim.sub = '<other-user-id>'; SELECT * FROM payment_intents WHERE template_user_id='<test-user-id>';"
# Expected: 0 rows (RLS blocks access)
```

### Step 5: Session Persistence (Remember Me)

**Action**: Close browser and return

**Expected Behavior**:

1. Close browser tab
2. Reopen browser
3. Navigate to `/dashboard`
4. Session restored from localStorage
5. User remains signed in (no re-authentication)
6. Token auto-refreshed if <5 min to expiration
7. Audit log entry: `event_type = 'token_refresh'` (if refreshed)

**Validation**:

```bash
# Check session expiration (should be ~30 days from sign-in)
# Browser console:
JSON.parse(localStorage.getItem('supabase.auth.token')).expires_at
# Should be current_time + 30 days (in seconds)

# Check token refresh logs
psql $DATABASE_URL -c "SELECT event_type, created_at FROM auth_audit_logs WHERE user_id=(SELECT id FROM auth.users WHERE email='test@example.com') AND event_type='token_refresh' ORDER BY created_at DESC LIMIT 5;"
```

## Edge Case Testing

### Test 1: Unverified User Access

**Action**: Try to access `/payment-demo` with unverified email

**Setup**:

```bash
# Create unverified user
psql $DATABASE_URL -c "INSERT INTO auth.users (email, encrypted_password, email_confirmed_at) VALUES ('unverified@example.com', crypt('Test1234!', gen_salt('bf')), NULL);"
```

**Expected Behavior**:

1. Sign in with unverified email
2. Attempt to access `/payment-demo`
3. Redirected to `/verify-email` with message
4. Cannot access payment features until verified

### Test 2: Rate Limiting

**Action**: Attempt 6 failed sign-ins

**Expected Behavior**:

1. Try to sign in with wrong password 5 times
2. Each attempt tracked in localStorage
3. 6th attempt blocked client-side: "Too many attempts. Try again in 15 minutes."
4. Supabase also blocks at server (backup protection)

### Test 3: Session Expiration

**Action**: Access protected page with expired session

**Setup**:

```bash
# Manually expire session in localStorage (browser console)
let session = JSON.parse(localStorage.getItem('supabase.auth.token'))
session.expires_at = Date.now() / 1000 - 3600  // 1 hour ago
localStorage.setItem('supabase.auth.token', JSON.stringify(session))
```

**Expected Behavior**:

1. Navigate to `/payment-demo`
2. Middleware detects expired session
3. Attempts token refresh
4. Refresh fails (token too old)
5. Redirected to `/sign-in` with message: "Session expired. Please sign in again."

## Success Criteria

All tests pass when:

- [x] User can sign up with email/password
- [x] Verification email sent and link works
- [x] User can sign in after verification
- [x] "Remember Me" extends session to 30 days
- [x] Protected routes require authentication
- [x] Users only see their own payment data (RLS enforced)
- [x] Session persists across browser restarts
- [x] Token auto-refreshes before expiration
- [x] Unverified users redirected to verification page
- [x] Rate limiting blocks brute force attempts
- [x] Expired sessions handled gracefully

## Cleanup

```bash
# Remove test user
psql $DATABASE_URL -c "DELETE FROM auth.users WHERE email='test@example.com';"
# Cascade deletes: user_profiles, auth_audit_logs, payment_intents

# Clear localStorage (browser console)
localStorage.clear()
```

## Next Steps

After quickstart validation:

1. Run full E2E test suite: `docker compose exec scripthammer pnpm test:e2e`
2. Run accessibility tests: `docker compose exec scripthammer pnpm test:a11y`
3. Load test with k6: `k6 run tests/load/auth-load.js`
4. Security audit: `npm audit && snyk test`

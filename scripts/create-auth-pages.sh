#!/bin/bash
# Create all auth page routes

# T050: Sign-up page
mkdir -p src/app/sign-up
cat > src/app/sign-up/page.tsx << 'EOF'
import React from 'react';
import SignUpForm from '@/components/auth/SignUpForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Create Account
        </h1>

        <SignUpForm onSuccess={() => (window.location.href = '/profile')} />

        <div className="divider my-6">OR</div>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/sign-in" className="link-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
EOF

# T051: Sign-in page
mkdir -p src/app/sign-in
cat > src/app/sign-in/page.tsx << 'EOF'
import React from 'react';
import SignInForm from '@/components/auth/SignInForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Sign In
        </h1>

        <SignInForm onSuccess={() => (window.location.href = '/profile')} />

        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="link-primary">
            Forgot password?
          </Link>
        </p>

        <div className="divider my-6">OR</div>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="link-primary">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
EOF

# T052: Forgot password page
mkdir -p src/app/forgot-password
cat > src/app/forgot-password/page.tsx << 'EOF'
import React from 'react';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Reset Password
        </h1>

        <p className="mb-6 text-center text-sm opacity-70">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-sm">
          <Link href="/sign-in" className="link-primary">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
EOF

# T053: Reset password page
mkdir -p src/app/reset-password
cat > src/app/reset-password/page.tsx << 'EOF'
import React from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Set New Password
        </h1>

        <ResetPasswordForm onSuccess={() => (window.location.href = '/sign-in')} />
      </div>
    </div>
  );
}
EOF

# T054: Email verification page
mkdir -p src/app/verify-email
cat > src/app/verify-email/page.tsx << 'EOF'
import React from 'react';
import EmailVerificationNotice from '@/components/auth/EmailVerificationNotice';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Verify Your Email
        </h1>

        <EmailVerificationNotice className="mb-6" />

        <p className="text-center text-sm opacity-70">
          Check your inbox for a verification link. Once verified, you&apos;ll be able to access all features.
        </p>

        <p className="mt-6 text-center text-sm">
          <Link href="/profile" className="link-primary">
            Go to profile
          </Link>
        </p>
      </div>
    </div>
  );
}
EOF

# T055: Profile page (protected)
mkdir -p src/app/profile
cat > src/app/profile/page.tsx << 'EOF'
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import UserProfileCard from '@/components/auth/UserProfileCard';
import Link from 'next/link';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
            Your Profile
          </h1>

          <UserProfileCard className="mb-6" />

          <div className="flex justify-center gap-4">
            <Link href="/account" className="btn btn-primary min-h-11">
              Account Settings
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
EOF

# T056: Account settings page (protected)
mkdir -p src/app/account
cat > src/app/account/page.tsx << 'EOF'
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AccountSettings from '@/components/auth/AccountSettings';
import Link from 'next/link';

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <Link href="/profile" className="btn btn-ghost min-h-11">
              Back to Profile
            </Link>
          </div>

          <AccountSettings />
        </div>
      </div>
    </ProtectedRoute>
  );
}
EOF

# T057: OAuth callback route
mkdir -p src/app/auth/callback
cat > src/app/auth/callback/route.ts << 'EOF'
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to profile after successful OAuth
  return NextResponse.redirect(new URL('/profile', requestUrl.origin));
}
EOF

echo "Auth pages created successfully"

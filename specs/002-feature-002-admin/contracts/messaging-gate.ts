/**
 * MessagingGate Contract
 *
 * Component that wraps /messages route content and blocks
 * access for users with unverified email addresses.
 */

import type { ReactNode } from 'react';

export interface MessagingGateProps {
  /** Child content to render when email is verified */
  children: ReactNode;
}

export interface EmailVerificationStatus {
  /** Whether user has verified email */
  isVerified: boolean;
  /** Whether user signed in via OAuth (auto-verified) */
  isOAuth: boolean;
  /** User's email address */
  email: string | null;
}

/**
 * MessagingGate Component Behavior
 *
 * Render states:
 * 1. Loading: Show spinner while checking auth status
 * 2. Not logged in: Redirect to /auth/signin
 * 3. Email not verified (non-OAuth): Show verification required UI
 * 4. Email verified OR OAuth: Render children
 *
 * Email verification check:
 * - Check auth.users.email_confirmed_at via Supabase
 * - OAuth users have this set by provider
 * - Email users must click verification link
 *
 * Blocked state UI:
 * - Lock icon
 * - "Email Verification Required" heading
 * - Explanation text
 * - Resend verification button (reuses EmailVerificationNotice pattern)
 * - User's email displayed for context
 */
export interface MessagingGateComponent {
  (props: MessagingGateProps): ReactNode;
}

/**
 * Verification Required UI Props
 */
export interface VerificationRequiredProps {
  /** User's email to display */
  email: string;
  /** Handler for resend button click */
  onResend: () => Promise<void>;
  /** Whether resend is in progress */
  isResending: boolean;
  /** Error message if resend failed */
  resendError?: string;
  /** Success message if resend succeeded */
  resendSuccess?: boolean;
}

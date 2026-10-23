/**
 * The address a person is waiting to confirm, carried from the form that created the need
 * to /verify-email (#1352).
 *
 * Production refuses an unconfirmed sign-in, so nobody in this state holds a session and
 * /verify-email cannot ask the auth context who they are. The sign-up form and the sign-in
 * form's "Email not confirmed" branch know the address; this hands it across the navigation.
 *
 * sessionStorage and not the query string: a query string puts the address in browser
 * history, the Referer of every outbound link and analytics. sessionStorage is scoped to
 * the tab, gone when the tab closes, and never sent anywhere.
 *
 * @module lib/auth/pending-confirmation
 */

const KEY = 'pending-confirmation-email';

/** Remember the address. Storage that is unavailable or full is not worth failing a sign-up for. */
export function setPendingConfirmationEmail(email: string): void {
  try {
    window.sessionStorage.setItem(KEY, email.trim());
  } catch {
    // The page falls back to asking for the address.
  }
}

/** The remembered address, or null when nothing was carried. */
export function getPendingConfirmationEmail(): string | null {
  try {
    return window.sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function clearPendingConfirmationEmail(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * A single auth audit row, as the signed-in user can see their OWN entries.
 * Shape mirrors the `auth_audit_logs` table (the columns RLS exposes to the user).
 */
export interface UserAuditEntry {
  id: string;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface UserAuditTrailProps {
  /** How many recent events to show (default 25). */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Human labels for the auth event types stored in `auth_audit_logs`.
 */
const EVENT_LABELS: Record<string, string> = {
  sign_up: 'Account created',
  sign_in: 'Signed in',
  sign_in_success: 'Signed in',
  sign_in_failed: 'Failed sign-in',
  sign_out: 'Signed out',
  password_change: 'Password changed',
  password_reset_request: 'Password reset requested',
  password_reset_complete: 'Password reset completed',
  email_verification: 'Email verification',
  email_verification_sent: 'Verification email sent',
  email_verification_complete: 'Email verified',
  token_refresh: 'Session refreshed',
  account_delete: 'Account deleted',
  oauth_link: 'Linked a sign-in provider',
  oauth_unlink: 'Unlinked a sign-in provider',
};

function labelFor(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * UserAuditTrail — a user-facing "recent security activity" view (#23, feature 005).
 *
 * Renders the signed-in user's own auth audit log (sign-ins, password changes,
 * verification, etc.). Security comes from RLS: the `auth_audit_logs` policy
 * "Users can view own audit logs" (`auth.uid() = user_id`) means a plain
 * authenticated SELECT returns ONLY this user's rows — no client-side user_id
 * filter is trusted for isolation. Mirrors the admin AdminAuditTrail organism
 * but intentionally simpler (no cross-user views, no burst grouping).
 *
 * @category molecular
 */
export default function UserAuditTrail({
  limit = 25,
  className = '',
}: UserAuditTrailProps) {
  const [entries, setEntries] = useState<UserAuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // RLS scopes this to the caller's own rows (auth.uid() = user_id).
      const { data, error: queryError } = await supabase
        .from('auth_audit_logs')
        .select('id, event_type, success, ip_address, user_agent, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setEntries([]);
        return;
      }
      // Cast via `unknown`: the generated src/lib/supabase/types.ts is stale —
      // its `auth_audit_logs.Row` omits the `success` / `error_message` columns
      // that exist in the live table + the monolithic migration, so the query
      // builder mis-infers a SelectQueryError. The runtime row has `success`.
      // (Regenerating the Supabase types is tracked separately, out of #23 scope.)
      setEntries((data ?? []) as unknown as UserAuditEntry[]);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <section
      className={`user-audit-trail${className ? ` ${className}` : ''}`}
      aria-labelledby="user-audit-trail-heading"
    >
      <h2 id="user-audit-trail-heading" className="mb-1 text-xl font-bold">
        Recent security activity
      </h2>
      <p className="text-base-content/70 mb-4 text-sm">
        Your account&apos;s recent sign-ins and security events. Entries are
        kept for 90 days.
      </p>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>Could not load your activity: {error}</span>
        </div>
      )}

      {!error && entries === null && (
        <div className="flex items-center gap-2 py-6" aria-busy="true">
          <span className="loading loading-spinner" aria-hidden="true" />
          <span>Loading your activity…</span>
        </div>
      )}

      {!error && entries !== null && entries.length === 0 && (
        <p className="text-base-content/70 py-6">No recent activity to show.</p>
      )}

      {!error && entries !== null && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table-zebra table">
            <caption className="sr-only">Your recent security events</caption>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">When</th>
                <th scope="col">Result</th>
                <th scope="col">IP address</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{labelFor(entry.event_type)}</td>
                  <td>
                    <time dateTime={entry.created_at}>
                      {formatWhen(entry.created_at)}
                    </time>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        entry.success ? 'badge-success' : 'badge-error'
                      }`}
                    >
                      {entry.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="font-mono text-sm">
                    {entry.ip_address ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

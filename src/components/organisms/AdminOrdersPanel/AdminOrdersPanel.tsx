'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  getIntakeSignedUrl,
  isPreviewable,
} from '@/lib/commerce/intake-upload';
import type { IntakeAttachment } from '@/types/commerce';

/**
 * Orders, and the files the buyer sent with them (#560, T022).
 *
 * WITHOUT THIS THE UPLOADER IS HALF A FEATURE. A buyer could attach eight
 * screenshots of the site they have and the look they want, and the operator had
 * nowhere to look at any of them — `intake-uploads` is a PRIVATE bucket (FR-016),
 * so there is no URL to paste anywhere. The files existed and were unreachable.
 *
 * READS ON THE ADMIN'S OWN SESSION, not a service-role key. Two policies already
 * grant exactly this and nothing more: `Admin can view all orders` (is_admin()) on
 * public.orders, and the is_admin() branch of the intake-uploads SELECT policy. A
 * service-role client in the browser would bypass RLS entirely and would be a far
 * larger grant than the job needs.
 *
 * SIGNED URLS ARE MINTED ON DEMAND, one file at a time, when the operator asks to
 * see it. Minting for every attachment on every row at page load would create
 * dozens of live URLs to files nobody opened — each valid for an hour, each a
 * credential, and each leaking into browser history and any logging in between.
 */

interface OrderRow {
  id: string;
  product_id: string;
  buyer_email: string | null;
  amount_charged: number | null;
  status: string;
  created_at: string;
  intake_data: Record<string, unknown> | null;
}

export interface AdminOrdersPanelProps {
  /** How many of the most recent orders to show. */
  limit?: number;
  className?: string;
}

const KIND_LABEL: Record<string, string> = {
  current: 'what they have',
  target: 'what they want',
  unspecified: 'untagged',
};

function money(cents: number | null): string {
  if (cents === null) return '—';
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function attachmentsOf(order: OrderRow): IntakeAttachment[] {
  const raw = order.intake_data?.['attachments'];
  return Array.isArray(raw) ? (raw as IntakeAttachment[]) : [];
}

export default function AdminOrdersPanel({
  limit = 25,
  className = '',
}: AdminOrdersPanelProps) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('orders')
        .select(
          'id, product_id, buyer_email, amount_charged, status, created_at, intake_data'
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (cancelled) return;
      if (err) {
        // RLS returning zero rows and a genuine failure look identical if you only
        // check for an empty array, so surface the error rather than rendering
        // "no orders yet" over the top of a broken query.
        setError(err.message);
      } else {
        setOrders((data ?? []) as OrderRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const open = useCallback(async (path: string) => {
    setOpening(path);
    const { url, error: err } = await getIntakeSignedUrl(path);
    setOpening(null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setError(err ?? 'Could not open that file');
    }
  }, []);

  if (loading) {
    return (
      <p role="status" className="text-base-content p-4">
        Loading orders…
      </p>
    );
  }

  return (
    <div className={`min-w-0 ${className}`}>
      {error && (
        <p role="alert" className="text-error mb-4 text-sm">
          {error}
        </p>
      )}

      {orders.length === 0 && !error && (
        <p className="text-base-content p-4">No orders yet.</p>
      )}

      <ul className="flex list-none flex-col gap-4 p-0">
        {orders.map((o) => {
          const files = attachmentsOf(o);
          const intake = o.intake_data ?? {};
          return (
            <li
              key={o.id}
              className="sh-plate min-w-0 rounded-[18px] p-4 sm:p-6"
              data-testid="admin-order"
            >
              <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-base-content font-mono text-xs">
                  {o.product_id}
                </span>
                <span className="text-base-content text-lg font-semibold">
                  {money(o.amount_charged)}
                </span>
                <span className="text-base-content text-sm">{o.status}</span>
                <span className="text-base-content text-xs">
                  {new Date(o.created_at).toLocaleString()}
                </span>
              </div>

              <p className="text-base-content mb-3 text-sm break-words">
                {String(intake['business'] ?? '—')} · {o.buyer_email ?? '—'} ·{' '}
                {String(intake['phone'] ?? 'no phone')}
              </p>

              {typeof intake['notes'] === 'string' && intake['notes'] && (
                <p className="text-base-content mb-3 text-sm break-words">
                  {intake['notes'] as string}
                </p>
              )}

              {files.length > 0 && (
                <ul className="flex list-none flex-col gap-2 p-0">
                  {files.map((a) => (
                    <li
                      key={a.path}
                      className="sh-groove bg-base-100 flex min-w-0 items-center gap-3 rounded-[10px] p-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-base-content block truncate text-sm">
                          {a.name}
                        </span>
                        <span className="text-base-content block text-xs">
                          {KIND_LABEL[a.kind] ?? a.kind}
                          {!isPreviewable(a.mime) && ' · no preview'}
                        </span>
                      </span>
                      {/*
                        A button, not an <a href>. There is no durable URL for a
                        private object — one has to be signed at the moment of the
                        click. Rendering an anchor would mean minting a live
                        credential for every file on the page whether or not anyone
                        ever opened it.
                      */}
                      <button
                        type="button"
                        onClick={() => void open(a.path)}
                        disabled={opening === a.path}
                        className="sh-btn sh-btn-ghost min-h-11 flex-none"
                      >
                        {opening === a.path ? 'Opening…' : 'Open'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';
// #259 iter 7 — the card that appears when you select a sampled building
// (in normal viewing, not just edit mode). It answers the user's ask for an
// in-view rating and "an indication when/where junk shows up": name + creator,
// the Warehouse community signals (rating, downloads), and a plain-spoken
// quality flag derived from the building's footprint extent. Visually it's the
// same glass card as the property-page house-details card — same family, one
// new differentiator (a status accent when a model may look rough).

import Link from 'next/link';
import { buildingQuality } from './buildingQuality';
import type { WarehouseModelEntry } from '@/lib/manifest';

const ACCENT: Record<1 | 2, string> = {
  1: '#e0b050', // amber — oversized
  2: '#e0685a', // red — very oversized
};

const FLAG_COPY: Record<1 | 2, string> = {
  1: 'May look rough — oversized model',
  2: 'Likely rough — very oversized model',
};

export default function SelectedBuildingCard({
  entry,
  onDismiss,
}: {
  entry: WarehouseModelEntry;
  onDismiss: () => void;
}) {
  const q = buildingQuality(entry.dim);
  const accent = q.level > 0 ? ACCENT[q.level as 1 | 2] : null;
  const rating =
    entry.rating != null
      ? `★${entry.rating.toFixed(1)}${entry.reviewCount ? ` (${entry.reviewCount})` : ''}`
      : 'Unrated';

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 120,
        width: 260,
        padding: '14px 16px',
        background: 'rgba(12, 16, 24, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderLeft: accent
          ? `3px solid ${accent}`
          : '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        color: '#f0ead8',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        zIndex: 11,
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss building info"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 24,
          height: 24,
          lineHeight: '22px',
          textAlign: 'center',
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent',
          color: 'inherit',
          fontSize: 15,
          cursor: 'pointer',
          opacity: 0.7,
        }}
      >
        ×
      </button>

      <div style={{ fontSize: 15, fontWeight: 700, paddingRight: 20 }}>
        {entry.title}
      </div>
      {entry.creator ? (
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
          {entry.creator}
        </div>
      ) : null}
      {/* Credit in place, not just on a credits page nobody opens (#714). The 3D Warehouse
          licence requires no attribution — this is courtesy, and it costs one link. */}
      {entry.url ? (
        <div style={{ fontSize: 11.5, marginTop: 6 }}>
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: '#9ec5fe', textDecoration: 'none' }}
          >
            View on 3D Warehouse ↗
          </a>
          <span style={{ opacity: 0.5 }}> · </span>
          <Link
            href="/credits"
            style={{ color: '#9ec5fe', textDecoration: 'none' }}
          >
            credits &amp; licence
          </Link>
        </div>
      ) : null}

      <dl style={{ margin: '10px 0 0', fontSize: 12.5 }}>
        <Row label="Rating" value={rating} />
        <Row
          label="Downloads"
          value={
            entry.downloads != null ? entry.downloads.toLocaleString() : '—'
          }
        />
      </dl>

      {q.level > 0 && accent ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            fontWeight: 600,
            color: accent,
          }}
        >
          {FLAG_COPY[q.level as 1 | 2]}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '2px 0',
      }}
    >
      <dt style={{ opacity: 0.65 }}>{label}</dt>
      <dd style={{ margin: 0, textAlign: 'right' }}>{value}</dd>
    </div>
  );
}

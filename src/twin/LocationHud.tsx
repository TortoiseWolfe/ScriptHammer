'use client';
// #706 — the "where am I" readout for Walk/Ride.
//
// Exists because bug reports from inside the city were not reproducible: "I can't walk up
// the stairs of the more detailed GLB imports" cannot be acted on without knowing which
// building. This puts an exact, copyable coordinate in front of the player.
//
// No geocoder and no network: latitude/longitude come from the site's own ENU projection,
// and the "near" line is the closest landmark in models.json. That keeps the readout
// instant, offline, and correct — a real street address needs a geocoder and is tracked
// separately rather than bolted on here.
//
// Visually the same glass card as SelectedBuildingCard, and NOT hidden on small screens:
// most E2E specs run at 390 px, so a desktop-only panel would be invisible to every gate
// in the project (#378-adjacent lesson).

interface Props {
  lat: number;
  lon: number;
  /** ENU metres — what the physics harness consumes directly. */
  x: number;
  z: number;
  near: string | null;
  osmHref: string;
  /** Copies the marker block; resolves true when the clipboard accepted it. */
  onCopy: () => void;
  /** Shows the confirmation for a beat after a successful copy. */
  copied: boolean;
}

const LABEL = 'rgba(226, 232, 240, 0.62)';
const VALUE = '#f1f5f9';

export default function LocationHud({
  lat,
  lon,
  x,
  z,
  near,
  osmHref,
  onCopy,
  copied,
}: Props) {
  return (
    <div
      data-testid="twin-coordinates"
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        maxWidth: 'calc(100vw - 32px)',
        padding: '10px 12px',
        background: 'rgba(12, 16, 24, 0.72)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: 12,
        backdropFilter: 'blur(8px)',
        color: VALUE,
        font: '500 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
        pointerEvents: 'auto',
        zIndex: 5,
      }}
    >
      <div style={{ color: LABEL, letterSpacing: '0.08em', fontSize: 10 }}>
        COORDINATES
      </div>
      <div style={{ fontSize: 13, marginTop: 2 }}>
        {lat.toFixed(6)}, {lon.toFixed(6)}
      </div>
      {near ? (
        <div style={{ color: LABEL, marginTop: 2 }}>near {near}</div>
      ) : null}
      <div style={{ color: LABEL, marginTop: 2 }}>
        ENU {x.toFixed(1)}, {z.toFixed(1)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={onCopy}
          // 44 px minimum touch target — the repo's mobile-first floor.
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: copied
              ? 'rgba(74, 222, 128, 0.18)'
              : 'rgba(148, 163, 184, 0.12)',
            color: VALUE,
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied' : 'Copy spot'}
        </button>
        <a
          href={osmHref}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 12px',
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: VALUE,
            textDecoration: 'none',
            font: 'inherit',
          }}
        >
          OpenStreetMap ↗
        </a>
      </div>
    </div>
  );
}

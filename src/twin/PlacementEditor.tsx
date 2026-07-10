'use client';
// #259 placement editor (?edit): DOM overlay for hand-tuning a selected
// sampled building. All state lives in the composition root (TwinCanvas) —
// this component is pure props, like the Hud. The Export button copies the
// full overrides JSON to the clipboard for pasting into
// scripts/warehouse/overrides-<site>.json (the durable record merged at emit
// time); localStorage keeps edits live across reloads until then.
import { useState } from 'react';
import type {
  TwinPlacementOverride,
  WarehouseModelEntry,
} from '@/lib/manifest';

const glass: React.CSSProperties = {
  background: 'rgba(12, 16, 24, 0.72)',
  backdropFilter: 'blur(10px)',
  borderRadius: 12,
  color: '#f4f6fb',
  pointerEvents: 'auto',
};

const btn: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '4px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
};

function Row({
  label,
  value,
  steps,
  onDelta,
}: {
  label: string;
  value: string;
  steps: { text: string; delta: number }[];
  onDelta: (d: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'space-between',
      }}
    >
      <span style={{ width: 52, fontSize: 13, opacity: 0.85 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {steps.map((s) => (
          <button
            key={s.text}
            style={btn}
            onClick={() => onDelta(s.delta)}
            aria-label={`${label} ${s.text}`}
          >
            {s.text}
          </button>
        ))}
      </div>
      <span
        style={{
          width: 64,
          textAlign: 'right',
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function PlacementEditor({
  entry,
  override,
  overrideCount,
  gizmoMode,
  onGizmoMode,
  onChange,
  onReset,
  onExport,
  onClearAll,
}: {
  /** The selected building's EFFECTIVE values (entry merged with override). */
  entry: WarehouseModelEntry | null;
  override: TwinPlacementOverride;
  /** How many models currently carry local overrides (export scope hint). */
  overrideCount: number;
  /** In-scene gizmo handle set (Move = ground-plane drag, Rotate = yaw ring). */
  gizmoMode?: 'translate' | 'rotate';
  onGizmoMode?: (mode: 'translate' | 'rotate') => void;
  onChange: (patch: TwinPlacementOverride) => void;
  onReset: () => void;
  /** Returns the JSON that was exported (already on the clipboard). */
  onExport: () => Promise<void>;
  onClearAll: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      style={{
        ...glass,
        position: 'absolute',
        top: 84,
        right: 16,
        width: 320,
        padding: '14px 16px',
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        Placement editor{' '}
        <span style={{ opacity: 0.6, fontWeight: 400 }}>
          · {overrideCount} tuned
        </span>
      </div>
      {entry ? (
        <>
          <div style={{ fontSize: 13, opacity: 0.9 }}>{entry.title}</div>
          {gizmoMode && onGizmoMode ? (
            <div
              role="group"
              aria-label="Gizmo mode"
              style={{ display: 'flex', gap: 6 }}
            >
              {(
                [
                  ['translate', 'Move'],
                  ['rotate', 'Rotate'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  style={{
                    ...btn,
                    flex: 1,
                    ...(gizmoMode === key
                      ? {
                          background: 'rgba(102,170,255,0.25)',
                          // Full shorthand — mixing `border` (from btn) with
                          // `borderColor` trips React's style-conflict error.
                          border: '1px solid rgba(102,170,255,0.6)',
                        }
                      : {}),
                  }}
                  aria-pressed={gizmoMode === key}
                  onClick={() => onGizmoMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <Row
            label="Yaw"
            value={`${(override.yawDeg ?? entry.yawDeg ?? 0).toFixed(0)}°`}
            steps={[
              { text: '-15', delta: -15 },
              { text: '-1', delta: -1 },
              { text: '+1', delta: 1 },
              { text: '+15', delta: 15 },
            ]}
            onDelta={(d) =>
              onChange({
                yawDeg: (override.yawDeg ?? entry.yawDeg ?? 0) + d,
              })
            }
          />
          <Row
            label="Height"
            value={`${(override.yOffset ?? entry.yOffset ?? 0).toFixed(2)}m`}
            steps={[
              { text: '-1', delta: -1 },
              { text: '-.25', delta: -0.25 },
              { text: '+.25', delta: 0.25 },
              { text: '+1', delta: 1 },
            ]}
            onDelta={(d) =>
              onChange({
                yOffset:
                  Math.round(
                    ((override.yOffset ?? entry.yOffset ?? 0) + d) * 100
                  ) / 100,
              })
            }
          />
          <Row
            label="E–W"
            value={`${(override.dx ?? 0).toFixed(1)}m`}
            steps={[
              { text: 'W2', delta: -2 },
              { text: 'W.5', delta: -0.5 },
              { text: 'E.5', delta: 0.5 },
              { text: 'E2', delta: 2 },
            ]}
            onDelta={(d) =>
              onChange({ dx: Math.round(((override.dx ?? 0) + d) * 10) / 10 })
            }
          />
          <Row
            label="N–S"
            value={`${(override.dz ?? 0).toFixed(1)}m`}
            steps={[
              { text: 'N2', delta: -2 },
              { text: 'N.5', delta: -0.5 },
              { text: 'S.5', delta: 0.5 },
              { text: 'S2', delta: 2 },
            ]}
            onDelta={(d) =>
              onChange({ dz: Math.round(((override.dz ?? 0) + d) * 10) / 10 })
            }
          />
          <Row
            label="Scale"
            value={`×${(override.scale ?? entry.scale ?? 1).toFixed(2)}`}
            steps={[
              { text: '-2%', delta: -0.02 },
              { text: '+2%', delta: 0.02 },
            ]}
            onDelta={(d) =>
              onChange({
                scale:
                  Math.round(((override.scale ?? entry.scale ?? 1) + d) * 100) /
                  100,
              })
            }
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              style={btn}
              onClick={() => onChange({ exclude: !override.exclude })}
              aria-pressed={!!override.exclude}
            >
              {override.exclude ? 'Excluded ✕' : 'Exclude'}
            </button>
            <button style={btn} onClick={onReset}>
              Reset
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55 }}>
            Drag the gizmo, or keys: [ ] yaw · − = height · arrows nudge
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Click a sampled building to select it.
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderTop: '1px solid rgba(255,255,255,0.15)',
          paddingTop: 8,
        }}
      >
        <button
          style={{ ...btn, flex: 1 }}
          onClick={async () => {
            await onExport();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? 'Copied ✓' : 'Export JSON'}
        </button>
        <button style={btn} onClick={onClearAll}>
          Clear local
        </button>
      </div>
    </div>
  );
}

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
  saveAvailable = false,
  onSaveToFile,
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
  /** Resolves false when the clipboard write was refused (the JSON is then
   *  logged to the console as the fallback channel). */
  onExport: () => Promise<boolean>;
  onClearAll: () => void;
  /** Local dev only: the overrides sidecar is answering, so edits can be
   *  written straight to the model file. */
  saveAvailable?: boolean;
  onSaveToFile?: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState<'ok' | 'fail' | false>(false);
  const [saved, setSaved] = useState<'ok' | 'fail' | false>(false);

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
        // Short viewports must scroll the panel, not lose its bottom buttons.
        maxHeight: 'min(70vh, 640px)',
        overflowY: 'auto',
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
            Click a building to select · drag the gizmo, or keys: [ ] yaw · − =
            height · arrows nudge
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Click a sampled building to select it.
        </div>
      )}
      {/* Persistence status — names WHERE edits live so "is there a save?"
          has a visible answer. Edits always auto-save to this browser; on
          local dev the Save button also writes them into the model file. */}
      <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
        {saveAvailable
          ? 'Edits auto-save in this browser. Save to the model file, then re-bake to apply.'
          : 'Edits auto-save in this browser only (static site — can’t write the model file).'}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderTop: '1px solid rgba(255,255,255,0.15)',
          paddingTop: 8,
        }}
      >
        {saveAvailable && onSaveToFile ? (
          <button
            style={{
              ...btn,
              flex: 1,
              background:
                saved === 'ok'
                  ? 'rgba(102,200,120,0.3)'
                  : 'rgba(102,170,255,0.28)',
              border: '1px solid rgba(102,170,255,0.6)',
            }}
            onClick={async () => {
              const ok = await onSaveToFile();
              setSaved(ok ? 'ok' : 'fail');
              setTimeout(() => setSaved(false), ok ? 2500 : 4000);
            }}
          >
            {saved === 'ok'
              ? 'Saved to model file ✓'
              : saved === 'fail'
                ? 'Save failed — is the dev server up?'
                : 'Save to model file'}
          </button>
        ) : (
          <button
            style={{ ...btn, flex: 1 }}
            onClick={async () => {
              const ok = await onExport();
              setCopied(ok ? 'ok' : 'fail');
              setTimeout(() => setCopied(false), ok ? 2000 : 4000);
            }}
          >
            {copied === 'ok'
              ? 'Copied ✓'
              : copied === 'fail'
                ? 'Copy failed — JSON in console'
                : 'Copy JSON'}
          </button>
        )}
        <button
          style={btn}
          onClick={() => {
            if (
              overrideCount === 0 ||
              window.confirm(
                `Discard ${overrideCount} local placement edit${overrideCount === 1 ? '' : 's'}?`
              )
            ) {
              onClearAll();
            }
          }}
        >
          Clear local
        </button>
      </div>
    </div>
  );
}

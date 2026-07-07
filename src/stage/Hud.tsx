'use client';

// Chattanooga Mini — generic glass HUD, ported from cm/cm-hud.js.
// Every piece of copy (wordmark, subtitle, mode labels, palette labels,
// caption, provenance) arrives via props. This component owns ZERO
// project-specific strings, so it (and its visual style) can be lifted
// back into ScriptHammer core as a reusable "3D Stage HUD" alongside
// StageCore/Rig — see progress.md T20 note.

export interface HudOption {
  key: string;
  label: string;
}

export interface HudCaption {
  name: string;
  blurb: string;
}

export interface HudProps {
  title: string;
  subtitle?: string;
  provenance: string;
  modes: HudOption[];
  activeMode: string;
  onMode: (key: string) => void;
  palettes: HudOption[];
  activePalette: string;
  onPalette: (key: string) => void;
  caption?: HudCaption | null;
  showFps: boolean;
  fps?: number;
}

const glass: React.CSSProperties = {
  background: 'rgba(12, 16, 24, 0.55)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
  color: '#f0ead8',
};

const dockButtonBase: React.CSSProperties = {
  appearance: 'none',
  border: '1px solid transparent',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  cursor: 'pointer',
  color: 'inherit',
  background: 'transparent',
  transition: 'background 120ms ease, border-color 120ms ease',
};

function dockButtonStyle(active: boolean): React.CSSProperties {
  return {
    ...dockButtonBase,
    background: active ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
    borderColor: active ? 'rgba(255, 255, 255, 0.28)' : 'transparent',
    fontWeight: active ? 600 : 400,
  };
}

export default function Hud({
  title,
  subtitle,
  provenance,
  modes,
  activeMode,
  onMode,
  palettes,
  activePalette,
  onPalette,
  caption,
  showFps,
  fps,
}: HudProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        zIndex: 10,
      }}
    >
      {/* Wordmark + subtitle */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          ...glass,
          padding: '10px 16px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.2 }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            {subtitle}
          </div>
        ) : null}
      </div>

      {/* FPS counter */}
      {showFps ? (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            ...glass,
            padding: '6px 12px',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'auto',
          }}
        >
          {fps != null ? `${Math.round(fps)} fps` : '— fps'}
        </div>
      ) : null}

      {/* Mode dock + palette toggle row (bottom center) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        {caption ? (
          <div
            style={{
              ...glass,
              padding: '8px 14px',
              maxWidth: 420,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{caption.name}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              {caption.blurb}
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              ...glass,
              display: 'flex',
              gap: 4,
              padding: 4,
            }}
          >
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                style={dockButtonStyle(m.key === activeMode)}
                aria-pressed={m.key === activeMode}
                onClick={() => onMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div
            style={{
              ...glass,
              display: 'flex',
              gap: 4,
              padding: 4,
            }}
          >
            {palettes.map((p) => (
              <button
                key={p.key}
                type="button"
                style={dockButtonStyle(p.key === activePalette)}
                aria-pressed={p.key === activePalette}
                onClick={() => onPalette(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10.5, opacity: 0.6 }}>{provenance}</div>
      </div>
    </div>
  );
}

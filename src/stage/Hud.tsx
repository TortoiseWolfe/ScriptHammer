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

/** Navigation button rendered in the dock row (href must be fully resolved —
 *  the HUD is generic and does no basePath prefixing). */
export interface HudLink {
  label: string;
  href: string;
}

/** Continuous 0..1 control rendered as a labelled range slider (e.g. a layer
 *  fade for comparing vectors against the aerial ground truth). */
export interface HudSlider {
  key: string;
  label: string;
  value: number; // 0..1
  onChange: (value: number) => void;
}

/** One entry in the site directory panel ("yellow pages"). */
export interface HudDirectoryEntry {
  slug: string;
  title: string;
  /** Creator credit line (attribution). */
  creator?: string;
  /** Fully-resolved external link for the source/credit (optional). */
  url?: string;
  /** Community rating (e.g. 1–5 stars) + how many reviews back it. */
  rating?: number;
  reviewCount?: number;
}

/** A named group of directory entries (e.g. a neighborhood). */
export interface HudDirectoryGroup {
  key: string;
  label: string;
  entries: HudDirectoryEntry[];
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
  /** Optional third dock (e.g. an as-built ⇄ massing view switch). */
  views?: HudOption[];
  activeView?: string;
  onView?: (key: string) => void;
  /** Optional navigation buttons (e.g. a premium property page). */
  links?: HudLink[];
  /** Optional layer sliders (e.g. building-fade for registration checks). */
  sliders?: HudSlider[];
  /** Optional site directory ("yellow pages"): grouped, scrollable list of
   *  named places; selecting one typically flies the camera to it. */
  directory?: HudDirectoryGroup[];
  /** Open/close state + toggle live with the caller (like every dock). */
  directoryOpen?: boolean;
  onDirectoryToggle?: () => void;
  onDirectorySelect?: (slug: string) => void;
  /** Highlighted directory entry (e.g. the editor's selection). */
  directoryActive?: string | null;
  /** Optional edit-mode toggle (placement editor). Button renders only when
   *  the handler is provided. */
  editActive?: boolean;
  onEditToggle?: () => void;
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
  views,
  activeView,
  onView,
  links,
  sliders,
  directory,
  directoryOpen,
  onDirectoryToggle,
  onDirectorySelect,
  directoryActive,
  editActive,
  onEditToggle,
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

      {/* Site directory panel ("yellow pages") — scrollable grouped list */}
      {directory && directoryOpen ? (
        <div
          style={{
            position: 'absolute',
            top: showFps ? 64 : 16,
            right: 16,
            width: 300,
            maxHeight: 'min(60vh, 560px)',
            overflowY: 'auto',
            ...glass,
            padding: '10px 8px',
            pointerEvents: 'auto',
          }}
        >
          {directory.map((group) => (
            <div key={group.key} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  opacity: 0.7,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  padding: '6px 8px 4px',
                }}
              >
                {group.label} · {group.entries.length}
              </div>
              {group.entries.map((e) => (
                <div
                  key={e.slug}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onDirectorySelect?.(e.slug)}
                    style={{
                      ...dockButtonBase,
                      flex: 1,
                      textAlign: 'left',
                      minHeight: 44,
                      background:
                        directoryActive === e.slug
                          ? 'rgba(255,255,255,0.18)'
                          : 'transparent',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 13 }}>
                      {e.title}
                    </span>
                    {e.creator || e.rating != null ? (
                      <span
                        style={{ display: 'block', fontSize: 11, opacity: 0.6 }}
                      >
                        {e.creator}
                        {e.rating != null
                          ? ` · ★${e.rating.toFixed(1)}${e.reviewCount ? ` (${e.reviewCount})` : ''}`
                          : ''}
                      </span>
                    ) : null}
                  </button>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${e.title} source`}
                      style={{
                        ...dockButtonBase,
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        opacity: 0.6,
                      }}
                    >
                      ↗
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
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

          {views && views.length > 0 && onView ? (
            <div
              style={{
                ...glass,
                display: 'flex',
                gap: 4,
                padding: 4,
              }}
            >
              {views.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  style={dockButtonStyle(v.key === activeView)}
                  aria-pressed={v.key === activeView}
                  onClick={() => onView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : null}

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

          {links && links.length > 0 ? (
            <div
              style={{
                ...glass,
                display: 'flex',
                gap: 4,
                padding: 4,
              }}
            >
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  style={{
                    ...dockButtonStyle(false),
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  {l.label}
                </a>
              ))}
            </div>
          ) : null}

          {(directory && onDirectoryToggle) || onEditToggle ? (
            <div style={{ ...glass, display: 'flex', gap: 4, padding: 4 }}>
              {directory && onDirectoryToggle ? (
                <button
                  type="button"
                  style={dockButtonStyle(!!directoryOpen)}
                  aria-pressed={!!directoryOpen}
                  onClick={onDirectoryToggle}
                >
                  Directory
                </button>
              ) : null}
              {onEditToggle ? (
                <button
                  type="button"
                  style={dockButtonStyle(!!editActive)}
                  aria-pressed={!!editActive}
                  onClick={onEditToggle}
                >
                  Edit
                </button>
              ) : null}
            </div>
          ) : null}

          {sliders && sliders.length > 0
            ? sliders.map((s) => (
                <label
                  key={s.key}
                  style={{
                    ...glass,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ opacity: 0.8 }}>{s.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={s.value}
                    aria-label={s.label}
                    onChange={(e) => s.onChange(Number(e.target.value))}
                    style={{ width: 96, accentColor: '#f0ead8' }}
                  />
                </label>
              ))
            : null}
        </div>

        <div style={{ fontSize: 10.5, opacity: 0.6 }}>{provenance}</div>
      </div>
    </div>
  );
}

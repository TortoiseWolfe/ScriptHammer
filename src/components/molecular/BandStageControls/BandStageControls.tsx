import React from 'react';

export interface BandStageControlsProps {
  /** True while the band's set is playing from the stage. */
  playing: boolean;
  /** True while the band is muted (the set keeps its place). */
  muted: boolean;
  /** Called from the click itself, so the caller can unlock browser audio there. */
  onPlayToggle: () => void;
  onMuteToggle: () => void;
  /** Additional CSS classes */
  className?: string;
  style?: React.CSSProperties;
}

// Matches the walk-mode badges in TwinCanvas: dark glass over the 3D scene.
const PANEL: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: 6,
  background: 'rgba(12, 16, 24, 0.72)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 8,
  color: '#f0ead8',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 700,
};

const BUTTON: React.CSSProperties = {
  padding: '0 12px',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.24)',
  borderRadius: 6,
  color: '#f0ead8',
  font: 'inherit',
  cursor: 'pointer',
};

/**
 * Play and mute controls for the band stage at Ross's Landing (feature 053).
 * Shown in walk mode near the stage. Play/Pause changes its name with the state;
 * Mute keeps one name and reports its state through aria-pressed.
 *
 * @category molecular
 */
export default function BandStageControls({
  playing,
  muted,
  onPlayToggle,
  onMuteToggle,
  className = '',
  style,
}: BandStageControlsProps) {
  return (
    <div
      role="group"
      aria-label="Band stage"
      data-band-stage-controls=""
      className={`band-stage-controls${className ? ` ${className}` : ''}`}
      style={{ ...PANEL, ...style }}
    >
      <button
        type="button"
        className="min-h-11 min-w-11"
        style={BUTTON}
        onClick={onPlayToggle}
      >
        {playing ? 'Pause the set' : 'Play the set'}
      </button>
      <button
        type="button"
        className="min-h-11 min-w-11"
        style={BUTTON}
        aria-pressed={muted}
        onClick={onMuteToggle}
      >
        Mute band
      </button>
    </div>
  );
}

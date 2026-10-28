import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BandStageControls from './BandStageControls';

function setup(playing = false, muted = false) {
  const onPlayToggle = vi.fn();
  const onMuteToggle = vi.fn();
  render(
    <BandStageControls
      playing={playing}
      muted={muted}
      onPlayToggle={onPlayToggle}
      onMuteToggle={onMuteToggle}
    />
  );
  return { onPlayToggle, onMuteToggle };
}

describe('BandStageControls', () => {
  it('offers to play the set when stopped', () => {
    setup(false);
    expect(
      screen.getByRole('button', { name: 'Play the set' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pause the set' })
    ).not.toBeInTheDocument();
  });

  it('offers to pause the set while playing', () => {
    setup(true);
    expect(
      screen.getByRole('button', { name: 'Pause the set' })
    ).toBeInTheDocument();
  });

  it('calls onPlayToggle from the click', () => {
    const { onPlayToggle, onMuteToggle } = setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Play the set' }));
    expect(onPlayToggle).toHaveBeenCalledTimes(1);
    expect(onMuteToggle).not.toHaveBeenCalled();
  });

  it('reports mute state through aria-pressed and keeps its name', () => {
    setup(true, false);
    const mute = screen.getByRole('button', { name: 'Mute band' });
    expect(mute).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows pressed when muted', () => {
    const { onMuteToggle } = setup(true, true);
    const mute = screen.getByRole('button', { name: 'Mute band' });
    expect(mute).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(mute);
    expect(onMuteToggle).toHaveBeenCalledTimes(1);
  });

  it('gives both buttons 44px touch targets', () => {
    setup();
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('min-h-11');
      expect(b.className).toContain('min-w-11');
    }
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <BandStageControls
        playing={false}
        muted={false}
        onPlayToggle={() => {}}
        onMuteToggle={() => {}}
        className="custom-test-class"
      />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});

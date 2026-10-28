import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandStageControls from './BandStageControls';

expect.extend(toHaveNoViolations);

const noop = () => {};

describe('BandStageControls Accessibility', () => {
  it('has no violations when stopped', async () => {
    const { container } = render(
      <BandStageControls
        playing={false}
        muted={false}
        onPlayToggle={noop}
        onMuteToggle={noop}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations while playing and muted', async () => {
    const { container } = render(
      <BandStageControls
        playing
        muted
        onPlayToggle={noop}
        onMuteToggle={noop}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('labels the group so a screen reader names it', () => {
    const { getByRole } = render(
      <BandStageControls
        playing={false}
        muted={false}
        onPlayToggle={noop}
        onMuteToggle={noop}
      />
    );
    expect(getByRole('group', { name: 'Band stage' })).toBeInTheDocument();
  });

  it('keeps every button visible and focusable', () => {
    const { container } = render(
      <BandStageControls
        playing={false}
        muted={false}
        onPlayToggle={noop}
        onMuteToggle={noop}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => {
      expect(b).toBeVisible();
      expect(b).not.toHaveAttribute('tabindex', '-1');
    });
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandShow from './BandShow';

expect.extend(toHaveNoViolations);

describe('BandShow Accessibility', () => {
  it('should have no accessibility violations before the show', async () => {
    const { container } = render(
      <BandShow now={Date.parse('2026-10-27T12:00:00Z')} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('should have no accessibility violations after the show', async () => {
    const { container } = render(
      <BandShow now={Date.parse('2026-11-02T12:00:00Z')} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a labelled region with a labelled list of cities', () => {
    const { container } = render(
      <BandShow now={Date.parse('2026-10-27T12:00:00Z')} />
    );
    expect(container.querySelector('section')).toHaveAttribute(
      'aria-labelledby',
      'show'
    );
    expect(container.querySelector('ul')).toHaveAttribute(
      'aria-label',
      'Show times by city'
    );
  });
});

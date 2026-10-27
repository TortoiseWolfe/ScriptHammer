import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BandShow from './BandShow';

const at = (iso: string) => Date.parse(iso);

describe('BandShow', () => {
  it('names the show, the two nights and both slots in Eastern time', () => {
    render(<BandShow now={at('2026-10-27T12:00:00Z')} />);
    expect(
      screen.getByRole('heading', {
        name: 'The Band Wagon: One Night Only, Every City on Earth',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('LIVE Thursday 29 October')).toBeInTheDocument();
    expect(
      screen.getByText('REPLAY Saturday 31 October (Halloween)')
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Opening set 6:00 to 7:30 PM/)).toHaveLength(2);
    expect(screen.getAllByText(/Headline 8:00 to 10:00 PM/)).toHaveLength(2);
  });

  it('links the channel and the calendar file', () => {
    render(<BandShow now={at('2026-10-27T12:00:00Z')} />);
    const channel = screen.getByRole('link', {
      name: 'twitch.tv/scripthammer',
    });
    expect(channel).toHaveAttribute('href', 'https://twitch.tv/scripthammer');
    expect(channel.getAttribute('rel')).toContain('noopener');
    const ics = screen.getByRole('link', { name: /calendar/i });
    expect(ics.getAttribute('href')).toMatch(/\/band\/the-band-wagon\.ics$/);
    expect(ics).toHaveAttribute('download');
  });

  it('lists eight cities with their own clocks', () => {
    render(<BandShow now={at('2026-10-27T12:00:00Z')} />);
    const cities = screen.getAllByTestId('show-city');
    expect(cities).toHaveLength(8);
    const london = cities.find((c) => c.textContent?.includes('London'))!;
    const text = london.textContent!.replace(/\u00A0/g, ' ');
    expect(text).toContain('Opening set 10:00 PM to 11:30 PM');
    expect(text).toContain('Headline 12:00 AM to 2:00 AM (next day)');
  });

  it.each([
    ['2026-10-27T12:00:00Z', 'before', /Coming up Thursday 29 October/],
    ['2026-10-29T22:30:00Z', 'live', /live show is on tonight/],
    ['2026-10-30T12:00:00Z', 'between', /replay is Saturday 31 October/],
    ['2026-10-31T22:30:00Z', 'replay', /replay is on tonight/],
  ])('at %s the state is %s', (iso, state, text) => {
    render(<BandShow now={at(iso)} />);
    expect(screen.getByTestId('band-show')).toHaveAttribute(
      'data-state',
      state
    );
    expect(screen.getByTestId('band-show-status')).toHaveTextContent(text);
  });

  it('never says "coming up" or "upcoming" after the replay ends', () => {
    const { container } = render(<BandShow now={at('2026-11-01T02:00:00Z')} />);
    expect(screen.getByTestId('band-show')).toHaveAttribute(
      'data-state',
      'over'
    );
    expect(container.textContent).not.toMatch(/coming up|upcoming/i);
    expect(screen.queryAllByTestId('show-city')).toHaveLength(0);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('reads the visitor clock when no time is pinned', () => {
    // The real clock is past the replay by the time this suite is old; before
    // then it is earlier. Either way the state is one of the five.
    render(<BandShow />);
    expect(screen.getByTestId('band-show').getAttribute('data-state')).toMatch(
      /^(before|live|between|replay|over)$/
    );
  });
});

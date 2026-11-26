import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BandSchedule from './BandSchedule';

describe('BandSchedule', () => {
  it('names the grid and says the times are Eastern', () => {
    render(<BandSchedule />);
    expect(
      screen.getByRole('heading', { name: 'When we are on' })
    ).toBeInTheDocument();
    expect(screen.getByText(/All times are Eastern/)).toBeInTheDocument();
  });

  it('lists the daily rows and the Thursday rows', () => {
    render(<BandSchedule />);
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getAllByTestId('schedule-slot')).toHaveLength(8);
    expect(within(tables[1]).getAllByTestId('schedule-slot')).toHaveLength(3);
    expect(screen.getByText('Overnight Rotation')).toBeInTheDocument();
    expect(screen.getByText('Live Band Set')).toBeInTheDocument();
    expect(screen.getByText('Late Jams')).toBeInTheDocument();
  });

  it('writes the Thursday live set as 6:00 PM to 7:30 PM', () => {
    render(<BandSchedule />);
    const text = screen.getByTestId('band-schedule').textContent ?? '';
    expect(text.replace(/ /g, ' ')).toContain('6:00 PM to 7:30 PM');
  });

  it('links the channel and keeps the booking link', () => {
    render(<BandSchedule />);
    const channel = screen.getByRole('link', {
      name: 'twitch.tv/scripthammer',
    });
    expect(channel).toHaveAttribute('href', 'https://twitch.tv/scripthammer');
    expect(channel.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: 'Book the band' })).toHaveAttribute(
      'href',
      '/schedule?from=band'
    );
  });

  it('is a labelled section with an anchor to link to', () => {
    render(<BandSchedule />);
    const section = screen.getByTestId('band-schedule');
    expect(section).toHaveAttribute('id', 'stream-schedule');
    expect(section).toHaveAttribute(
      'aria-labelledby',
      'stream-schedule-heading'
    );
  });
});

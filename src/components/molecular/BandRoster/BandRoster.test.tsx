import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BandRoster from './BandRoster';
import { ROSTER } from '@/lib/band/roster';

describe('BandRoster', () => {
  it('shows all seven members by default', () => {
    render(<BandRoster />);
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getAllByTestId('band-member-card')).toHaveLength(7);
  });

  it('shows only the members it is given', () => {
    render(<BandRoster members={ROSTER.slice(0, 2)} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('labels the list', () => {
    render(<BandRoster />);
    expect(
      screen.getByRole('list', { name: 'Band members' })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(<BandRoster className="custom-test-class" />);
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});

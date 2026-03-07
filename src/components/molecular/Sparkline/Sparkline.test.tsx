import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Sparkline from './Sparkline';

describe('Sparkline', () => {
  it('renders an svg with polyline + area path for a normal series', () => {
    const { container } = render(
      <Sparkline data={[3, 5, 2, 8, 4, 6, 7]} testId="spark" />
    );
    const svg = container.querySelector('svg[data-testid="spark"]');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector('polyline[data-series]')).toBeInTheDocument();
    expect(svg?.querySelector('path')).toBeInTheDocument();
  });

  it('emits as many polyline points as data items', () => {
    const data = [1, 4, 2, 7, 3];
    const { container } = render(<Sparkline data={data} />);
    const points =
      container.querySelector('polyline')?.getAttribute('points') ?? '';
    // "x,y x,y ..." — one pair per datum
    expect(points.trim().split(/\s+/)).toHaveLength(data.length);
  });

  it('uses theme-token stroke — literal var() so DaisyUI recolors at paint time', () => {
    const { container, rerender } = render(
      <Sparkline data={[1, 2, 3]} tone="success" />
    );
    expect(container.querySelector('polyline')?.getAttribute('stroke')).toBe(
      'var(--color-success)'
    );
    // Area fill matches the stroke token — fillOpacity handles the dimming.
    expect(container.querySelector('path')?.getAttribute('fill')).toBe(
      'var(--color-success)'
    );

    rerender(<Sparkline data={[1, 2, 3]} tone="error" />);
    expect(container.querySelector('polyline')?.getAttribute('stroke')).toBe(
      'var(--color-error)'
    );
  });

  it('defaults to primary tone', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    expect(container.querySelector('polyline')?.getAttribute('stroke')).toBe(
      'var(--color-primary)'
    );
  });

  it('renders a flat line at bottom for an all-zero series — not empty', () => {
    const { container } = render(<Sparkline data={[0, 0, 0, 0, 0, 0, 0]} />);
    // All-zero is informative ("nothing happened"). Should still draw.
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const points =
      container.querySelector('polyline')?.getAttribute('points') ?? '';
    // Every y should be the same value (flat). Bottom of plot is
    // VB_H - PAD_Y = 23.0.
    const ys = points
      .trim()
      .split(/\s+/)
      .map((p) => p.split(',')[1]);
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBe('23.0');
  });

  it('renders empty placeholder when fewer than 2 points', () => {
    const { container, rerender } = render(<Sparkline data={[]} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.querySelector('[data-empty]')).toBeInTheDocument();

    rerender(<Sparkline data={[5]} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.querySelector('[data-empty]')).toBeInTheDocument();
  });

  it('is aria-hidden by default, role=img when labeled', () => {
    const { container, rerender } = render(<Sparkline data={[1, 2, 3]} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
    expect(container.querySelector('svg')?.getAttribute('role')).toBeNull();

    rerender(<Sparkline data={[1, 2, 3]} label="Logins, last 7 days" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Logins, last 7 days');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
  });

  it('forwards className', () => {
    const { container } = render(
      <Sparkline data={[1, 2, 3]} className="h-6 w-24" />
    );
    expect(container.querySelector('svg')?.getAttribute('class')).toBe(
      'h-6 w-24'
    );
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminTrendChart } from './AdminTrendChart';

const sample = [
  { label: 'Jun 1', value: 10 },
  { label: 'Jun 2', value: 25 },
  { label: 'Jun 3', value: 15 },
  { label: 'Jun 4', value: 40 },
  { label: 'Jun 5', value: 30 },
];

describe('AdminTrendChart', () => {
  it('renders an accessible SVG figure', () => {
    render(<AdminTrendChart data={sample} title="Refund rate" />);
    const figure = screen.getByRole('figure', { name: /refund rate/i });
    expect(figure).toBeInTheDocument();
    expect(figure.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a path for the trend line with stroke-primary by default', () => {
    const { container } = render(
      <AdminTrendChart data={sample} title="Trend" />
    );
    const line = container.querySelector('[data-chart-line]');
    expect(line).toBeInTheDocument();
    expect(line?.tagName.toLowerCase()).toBe('path');
    expect(line?.getAttribute('class')).toContain('stroke-primary');
    // Path must have a real d attribute with coordinates
    expect(line?.getAttribute('d')).toMatch(/^M\s/);
  });

  it('renders fill area under the line with matching fill token at low opacity', () => {
    const { container } = render(
      <AdminTrendChart data={sample} title="Trend" />
    );
    const area = container.querySelector('[data-chart-area]');
    expect(area?.getAttribute('class')).toContain('fill-primary');
    expect(area?.getAttribute('class')).toMatch(/opacity-\d+/);
  });

  it('renders one data point circle per datum with fill-primary', () => {
    const { container } = render(
      <AdminTrendChart data={sample} title="Trend" />
    );
    const points = container.querySelectorAll('[data-chart-point]');
    expect(points).toHaveLength(sample.length);
    points.forEach((p) => {
      expect(p.getAttribute('class')).toContain('fill-primary');
    });
  });

  it('applies the requested colorToken to stroke and fill classes', () => {
    const { container } = render(
      <AdminTrendChart data={sample} title="Errors" colorToken="error" />
    );
    expect(
      container.querySelector('[data-chart-line]')?.getAttribute('class')
    ).toContain('stroke-error');
    expect(
      container.querySelector('[data-chart-area]')?.getAttribute('class')
    ).toContain('fill-error');
    expect(
      container.querySelector('[data-chart-point]')?.getAttribute('class')
    ).toContain('fill-error');
  });

  it('renders gridlines with stroke-base-300 (theme-neutral)', () => {
    const { container } = render(
      <AdminTrendChart data={sample} title="Trend" />
    );
    const gridlines = container.querySelectorAll('[data-chart-grid]');
    expect(gridlines.length).toBeGreaterThan(0);
    gridlines.forEach((g) => {
      expect(g.getAttribute('class')).toContain('stroke-base-300');
    });
  });

  it('renders x-axis labels from data', () => {
    render(<AdminTrendChart data={sample} title="Trend" />);
    expect(screen.getByText('Jun 1')).toBeInTheDocument();
    expect(screen.getByText('Jun 5')).toBeInTheDocument();
  });

  it('formats y-axis ticks via yFormat when provided', () => {
    render(
      <AdminTrendChart
        data={sample}
        title="Rate"
        yFormat={(v) => `${v}%`}
      />
    );
    // max value is 40; default ticks include max
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<AdminTrendChart data={[]} title="Nothing yet" />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('handles a single data point without a line path', () => {
    const { container } = render(
      <AdminTrendChart data={[{ label: 'Only', value: 42 }]} title="One" />
    );
    // One point exists but a line needs 2+ points
    expect(container.querySelectorAll('[data-chart-point]')).toHaveLength(1);
    const line = container.querySelector('[data-chart-line]');
    expect(line).toBeNull();
  });

  it('handles flat series (all same value) without NaN coords', () => {
    const flat = [
      { label: 'A', value: 5 },
      { label: 'B', value: 5 },
      { label: 'C', value: 5 },
    ];
    const { container } = render(<AdminTrendChart data={flat} title="Flat" />);
    const line = container.querySelector('[data-chart-line]');
    expect(line?.getAttribute('d')).not.toContain('NaN');
  });

  it('scales y so the max value is at the top of the plot area', () => {
    // Two-point series: 0 and 100. In SVG y grows downward, so the
    // larger value must have the *smaller* cy.
    const { container } = render(
      <AdminTrendChart
        data={[
          { label: 'lo', value: 0 },
          { label: 'hi', value: 100 },
        ]}
        title="Scale"
      />
    );
    const pts = container.querySelectorAll('[data-chart-point]');
    const cyLo = Number(pts[0].getAttribute('cy'));
    const cyHi = Number(pts[1].getAttribute('cy'));
    expect(cyHi).toBeLessThan(cyLo);
  });

  it('exposes testId on the figure root', () => {
    render(<AdminTrendChart data={sample} title="Trend" testId="my-chart" />);
    expect(screen.getByTestId('my-chart')).toBeInTheDocument();
  });

  it('scales via viewBox aspect ratio, not height="auto"', () => {
    // Regression: admin-smoke caught `Error: <svg> attribute height: Expected
    // length, "auto"` in the browser console. "auto" is valid on <img> but the
    // SVG spec only accepts <length> | <percentage> for height — Chromium logs
    // the error and discards the attribute. jsdom doesn't validate SVG attrs so
    // this has to be an explicit assertion.
    //
    // The responsive-scaling intent was correct: width="100%" + viewBox gives
    // you height-from-aspect-ratio automatically. The explicit height attr was
    // a no-op at best; at worst it errors.
    const { container } = render(<AdminTrendChart data={sample} title="T" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('height')).not.toBe('auto');
    expect(svg?.getAttribute('viewBox')).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('100%');
  });

  describe('multi-series', () => {
    const dual = [
      {
        name: 'Messages',
        colorToken: 'primary' as const,
        data: [
          { label: 'Jun 1', value: 48 },
          { label: 'Jun 2', value: 120 },
          { label: 'Jun 3', value: 90 },
        ],
      },
      {
        name: 'New conversations',
        colorToken: 'secondary' as const,
        data: [
          { label: 'Jun 1', value: 2 },
          { label: 'Jun 2', value: 5 },
          { label: 'Jun 3', value: 1 },
        ],
      },
    ];

    it('draws one line per series with its own stroke token', () => {
      const { container } = render(
        <AdminTrendChart series={dual} title="Volume" />
      );
      const lines = container.querySelectorAll('[data-chart-line]');
      expect(lines).toHaveLength(2);
      const classes = Array.from(lines).map((l) => l.getAttribute('class'));
      expect(classes.some((c) => c?.includes('stroke-primary'))).toBe(true);
      expect(classes.some((c) => c?.includes('stroke-secondary'))).toBe(true);
    });

    it('draws N points per series with matching fill tokens', () => {
      const { container } = render(
        <AdminTrendChart series={dual} title="Volume" />
      );
      // 3 points × 2 series
      const points = container.querySelectorAll('[data-chart-point]');
      expect(points).toHaveLength(6);

      const primaryGroup = container.querySelector(
        '[data-chart-series="Messages"]'
      );
      primaryGroup
        ?.querySelectorAll('[data-chart-point]')
        .forEach((p) =>
          expect(p.getAttribute('class')).toContain('fill-primary')
        );

      const secondaryGroup = container.querySelector(
        '[data-chart-series="New conversations"]'
      );
      secondaryGroup
        ?.querySelectorAll('[data-chart-point]')
        .forEach((p) =>
          expect(p.getAttribute('class')).toContain('fill-secondary')
        );
    });

    it('suppresses area fill when >1 series', () => {
      // Stacked semi-transparent fills turn to mud. Lines + points only.
      const { container } = render(
        <AdminTrendChart series={dual} title="Volume" />
      );
      expect(container.querySelector('[data-chart-area]')).toBeNull();
    });

    it('single-series via `data` still gets an area (backward compat)', () => {
      const { container } = render(
        <AdminTrendChart data={sample} title="Refund rate" />
      );
      expect(container.querySelector('[data-chart-area]')).toBeInTheDocument();
    });

    it('renders a legend with one entry per series', () => {
      const { container } = render(
        <AdminTrendChart series={dual} title="Volume" />
      );
      const legend = container.querySelector('[data-chart-legend]');
      expect(legend).toBeInTheDocument();
      const items = legend?.querySelectorAll('li');
      expect(items).toHaveLength(2);
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('New conversations')).toBeInTheDocument();
    });

    it('legend swatches use bg-{token} matching each series', () => {
      const { container } = render(
        <AdminTrendChart series={dual} title="Volume" />
      );
      const swatches = container.querySelectorAll(
        '[data-chart-legend] li > span'
      );
      expect(swatches[0].className).toContain('bg-primary');
      expect(swatches[1].className).toContain('bg-secondary');
    });

    it('omits legend for single-series', () => {
      const { container } = render(
        <AdminTrendChart data={sample} title="Refund rate" />
      );
      expect(container.querySelector('[data-chart-legend]')).toBeNull();
    });

    it('y-domain spans all series (small-scale series sits near floor)', () => {
      // max=120 (messages), conversations top out at 5. On a shared axis
      // the conversations points must land strictly below the max-messages
      // point. SVG y grows downward ⇒ larger cy for the floor-huggers.
      const { container } = render(
        <AdminTrendChart series={dual} title="Volume" />
      );
      const msgGroup = container.querySelector(
        '[data-chart-series="Messages"]'
      );
      const convoGroup = container.querySelector(
        '[data-chart-series="New conversations"]'
      );
      // Jun 2 = index 1: messages=120 (the overall max), convos=5
      const msgCy = Number(
        msgGroup?.querySelectorAll('[data-chart-point]')[1].getAttribute('cy')
      );
      const convoCy = Number(
        convoGroup
          ?.querySelectorAll('[data-chart-point]')[1]
          .getAttribute('cy')
      );
      expect(convoCy).toBeGreaterThan(msgCy);
    });

    it('renders x-axis labels once (not per series)', () => {
      render(<AdminTrendChart series={dual} title="Volume" />);
      // Three days, two series. If x-labels were per-series we'd see
      // duplicates. getByText throws on multiples → this is the assertion.
      expect(screen.getByText('Jun 1')).toBeInTheDocument();
      expect(screen.getByText('Jun 2')).toBeInTheDocument();
      expect(screen.getByText('Jun 3')).toBeInTheDocument();
    });

    it('renders empty state when series have zero points', () => {
      render(
        <AdminTrendChart
          series={[{ name: 'Empty', colorToken: 'primary', data: [] }]}
          title="Nothing"
        />
      );
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });
});

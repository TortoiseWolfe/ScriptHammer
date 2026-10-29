import { describe, it, expect } from 'vitest';
import { createRenderScale } from '../renderScale';

const feed = (
  g: ReturnType<typeof createRenderScale>,
  dt: number,
  n: number
) => {
  let last: number | null = null;
  for (let i = 0; i < n; i++) {
    const r = g.sample(dt);
    if (r !== null) last = r;
  }
  return last;
};

describe('createRenderScale (#1423)', () => {
  it('starts at full scale and never leaves it on fast frames', () => {
    const g = createRenderScale();
    expect(g.scale).toBe(1);
    expect(feed(g, 0.016, 5000)).toBeNull();
    expect(g.scale).toBe(1);
  });

  it('ignores a lone hitch', () => {
    const g = createRenderScale();
    expect(g.sample(2)).toBeNull();
    expect(g.sample(0.016)).toBeNull();
    expect(g.sample(2)).toBeNull();
    expect(g.sample(0.016)).toBeNull();
    expect(g.scale).toBe(1);
  });

  it('drops straight to the floor on software-GL frame times (1.9 s)', () => {
    const g = createRenderScale();
    feed(g, 1.9, 3);
    expect(g.scale).toBe(0.25);
  });

  it('aims at the target frame time for a moderately slow machine', () => {
    const g = createRenderScale();
    feed(g, 0.24, 3); // 4x too slow, cost follows scale squared -> scale 0.5
    expect(g.scale).toBeCloseTo(0.5, 2);
  });

  it('never goes below the floor', () => {
    const g = createRenderScale({ min: 0.4 });
    feed(g, 5, 30);
    expect(g.scale).toBe(0.4);
  });

  it('raises back toward 1 after sustained fast frames', () => {
    const g = createRenderScale();
    feed(g, 1.9, 3);
    feed(g, 0.01, 90);
    expect(g.scale).toBeCloseTo(0.3125, 4);
    for (let i = 0; i < 10; i++) feed(g, 0.01, 90);
    expect(g.scale).toBe(1);
  });

  it('a middling frame resets the fast streak', () => {
    const g = createRenderScale();
    feed(g, 1.9, 3);
    for (let i = 0; i < 5; i++) {
      feed(g, 0.01, 80);
      g.sample(0.05);
    }
    expect(g.scale).toBe(0.25);
  });

  it('waits twice as long to raise again after a raise that went slow', () => {
    const g = createRenderScale();
    feed(g, 1.9, 3);
    feed(g, 0.01, 90); // raise
    expect(g.scale).toBeGreaterThan(0.25);
    feed(g, 1.0, 3); // too ambitious: drop again, backoff doubles the wait
    expect(g.scale).toBe(0.25);
    feed(g, 0.01, 90);
    expect(g.scale).toBe(0.25);
    feed(g, 0.01, 90);
    expect(g.scale).toBeGreaterThan(0.25);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './event-bus';

describe('EventBus', () => {
  it('delivers payloads to subscribers in registration order', () => {
    const bus = new EventBus<{ ping: number }>();
    const seen: string[] = [];
    bus.on('ping', (n) => seen.push(`a${n}`));
    bus.on('ping', (n) => seen.push(`b${n}`));
    bus.emit('ping', 1);
    expect(seen).toEqual(['a1', 'b1']);
  });

  it('on() returns an unsubscribe closure', () => {
    const bus = new EventBus<{ ping: number }>();
    let count = 0;
    const off = bus.on('ping', () => {
      count++;
    });
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 1);
    expect(count).toBe(1);
  });

  it('once() fires exactly once', () => {
    const bus = new EventBus<{ ping: number }>();
    let count = 0;
    bus.once('ping', () => {
      count++;
    });
    bus.emit('ping', 1);
    bus.emit('ping', 1);
    expect(count).toBe(1);
  });

  it('off() removes a handler', () => {
    const bus = new EventBus<{ ping: number }>();
    let count = 0;
    const fn = (): void => {
      count++;
    };
    bus.on('ping', fn);
    bus.off('ping', fn);
    bus.emit('ping', 1);
    expect(count).toBe(0);
  });

  it('isolates a throwing handler — the rest still run', () => {
    const bus = new EventBus<{ ping: number }>();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let ran = false;
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', () => {
      ran = true;
    });
    bus.emit('ping', 1);
    expect(ran).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('emit with no listeners is a no-op', () => {
    const bus = new EventBus<{ ping: number }>();
    expect(() => bus.emit('ping', 1)).not.toThrow();
  });

  it('a handler may unsubscribe mid-dispatch (set is copied per emit)', () => {
    const bus = new EventBus<{ ping: number }>();
    let bCount = 0;
    let offB: () => void = () => {};
    bus.on('ping', () => offB()); // unsubscribes b during dispatch
    offB = bus.on('ping', () => {
      bCount++;
    });
    bus.emit('ping', 1); // b still runs this dispatch
    bus.emit('ping', 1); // b now unsubscribed
    expect(bCount).toBe(1);
  });
});

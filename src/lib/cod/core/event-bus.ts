/**
 * Minimal synchronous event bus — game events without React re-renders.
 *
 * Ported to typed TS from Claude-of-Duty (MIT), `src/core/registry.js:86-122`
 * (extracted from the OVERWATCH service-locator, which is NOT harvested).
 * Handlers fire in registration order; a throwing handler is isolated (logged,
 * never stops the rest). `on`/`once` return an unsubscribe closure — ideal as a
 * React `useEffect` cleanup.
 *
 * `emit` copies the listener set so a handler may unsubscribe mid-dispatch. That
 * is one small allocation per emit — fine for discrete game events (footsteps,
 * hits, pickups); do not emit from a per-frame hot path.
 */

export type Handler<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export class EventBus<
  Events extends Record<string, unknown> = Record<string, unknown>,
> {
  #map = new Map<keyof Events, Set<Handler<unknown>>>();

  /** Subscribe to `type`. Returns an unsubscribe closure. */
  on<K extends keyof Events>(type: K, fn: Handler<Events[K]>): Unsubscribe {
    let set = this.#map.get(type);
    if (!set) {
      set = new Set();
      this.#map.set(type, set);
    }
    set.add(fn as Handler<unknown>);
    return () => this.off(type, fn);
  }

  /** Subscribe for a single emit, then auto-unsubscribe. */
  once<K extends keyof Events>(type: K, fn: Handler<Events[K]>): Unsubscribe {
    const off = this.on(type, (e) => {
      off();
      fn(e);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, fn: Handler<Events[K]>): void {
    this.#map.get(type)?.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.#map.get(type);
    if (!set) return;
    // Copy so handlers may unsubscribe during dispatch.
    for (const fn of [...set]) {
      try {
        (fn as Handler<Events[K]>)(payload);
      } catch (err) {
        console.error(`[events] handler for "${String(type)}" threw:`, err);
      }
    }
  }

  clear(): void {
    this.#map.clear();
  }
}

/** A world-space position payload. */
export interface Vec3Payload {
  x: number;
  y: number;
  z: number;
}

/**
 * The game-event vocabulary the toolkit's demo emits. Extend this map (or use a
 * fresh `new EventBus<YourEvents>()`) for a game's own events.
 */
export interface GameEvents extends Record<string, unknown> {
  'player:stance': { stance: string };
  'player:footstep': { surface: string; position: Vec3Payload };
}

/** Shared game-event bus. Emit from event handlers; subscribe in `useEffect`. */
export const bus = new EventBus<GameEvents>();

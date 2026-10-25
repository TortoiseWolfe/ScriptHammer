/**
 * Constant-time string comparison for Edge Functions (#1260).
 *
 * Prevents timing side-channels by always iterating over the length of the
 * longer string and using a bitwise accumulator. Fails closed on length
 * mismatch without an early exit.
 *
 * NOTHING IMPORTED AND NO `Deno` GLOBAL, so Vitest can exercise it from
 * tests/unit.
 */

export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  // Compare against a fixed-length accumulator so length differences don't
  // short-circuit (which would itself leak length via timing).
  let mismatch = bufA.length === bufB.length ? 0 : 1;
  const len = Math.max(bufA.length, bufB.length);

  for (let i = 0; i < len; i++) {
    // Using ?? 0 ensures we always perform the XOR and OR operations
    // even if we've passed the end of one of the buffers.
    mismatch |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }

  return mismatch === 0;
}

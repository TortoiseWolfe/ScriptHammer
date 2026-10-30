/**
 * Adaptive render scale (#1423).
 *
 * A machine that draws the scene in software (no GPU) takes seconds per frame, and the
 * browser answers every input event, a click included, at frame cadence. So a visitor
 * on such a machine presses Play and waits for several slow frames. Software drawing
 * cost follows the pixel count, so this governor lowers the render scale while frames
 * are slow and raises it again once they are fast. A machine that holds a fast frame
 * rate never leaves full scale.
 *
 * Pure and framework-free so StageCore can feed it frame times and a unit test can
 * drive it without a renderer.
 */
export interface RenderScaleOptions {
  /** Smallest scale it will drop to. Cost follows scale squared. */
  min?: number;
  /** A frame longer than this is slow, in seconds. */
  slowS?: number;
  /** A frame shorter than this is fast, in seconds. */
  fastS?: number;
  /** The frame time a drop aims for, in seconds. */
  targetS?: number;
  /** Consecutive slow frames before dropping (a lone hitch never counts). */
  slowFrames?: number;
  /** Consecutive fast frames before raising. */
  fastFrames?: number;
  /** Growth per raise. */
  raiseStep?: number;
}

const DEFAULTS: Required<RenderScaleOptions> = {
  min: 0.25,
  slowS: 0.1,
  fastS: 0.03,
  targetS: 0.06,
  slowFrames: 3,
  fastFrames: 90,
  raiseStep: 1.25,
};

/** Doubling cap on the fast-frame wait, so a machine that cannot hold a higher scale stops probing. */
const MAX_FAST_FRAMES = 1440;

export function createRenderScale(options: RenderScaleOptions = {}) {
  const o = { ...DEFAULTS, ...options };
  let scale = 1;
  let slowRun = 0;
  let slowSum = 0;
  let fastRun = 0;
  let fastNeeded = o.fastFrames;
  let lastWasRaise = false;

  return {
    get scale() {
      return scale;
    },
    /** Feed one frame's duration in seconds. Returns the new scale when it changed, else null. */
    sample(dt: number): number | null {
      if (dt > o.slowS) {
        fastRun = 0;
        slowRun += 1;
        slowSum += dt;
        if (slowRun < o.slowFrames) return null;
        const avg = slowSum / slowRun;
        slowRun = 0;
        slowSum = 0;
        if (scale <= o.min) return null;
        // Cost follows scale squared, so aim straight at the target frame time.
        const next = Math.max(o.min, scale * Math.sqrt(o.targetS / avg));
        if (lastWasRaise)
          fastNeeded = Math.min(fastNeeded * 2, MAX_FAST_FRAMES);
        lastWasRaise = false;
        scale = next;
        return scale;
      }
      slowRun = 0;
      slowSum = 0;
      if (dt < o.fastS && scale < 1) {
        fastRun += 1;
        if (fastRun >= fastNeeded) {
          fastRun = 0;
          lastWasRaise = true;
          scale = Math.min(1, scale * o.raiseStep);
          return scale;
        }
      } else {
        fastRun = 0;
      }
      return null;
    },
  };
}

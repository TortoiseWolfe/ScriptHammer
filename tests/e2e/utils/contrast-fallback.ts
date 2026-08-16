/**
 * Measure the contrast axe refuses to (#459).
 *
 * THE DEFECT THIS EXISTS FOR. axe returns a **pass** for any element whose ratio
 * it could not compute, with `contrastRatio: null` and the message "Element has
 * sufficient color contrast of null". Those land in `passes`, so a gate that
 * asserts only on `violations` counts "could not measure" as "verified" — the
 * one direction a probe must never round. Measured before this existed: 193 such
 * nodes across six routes, one in five of everything reported as passing.
 *
 * WHY ONE TECHNIQUE COVERS ALL OF THEM. Every single unmeasured node was text on
 * a **gradient**. axe gives up because the background varies across the element.
 * It does not vary unpredictably, though: a gradient interpolates between
 * ADJACENT stops, so luminance along the ramp always lies between the two stops
 * bounding it. Checking every declared stop therefore covers the extremes, and
 * no rasterising is needed.
 *
 * WHY CANVAS READBACK. `getComputedStyle` hands back `oklch()` / `oklab()`
 * verbatim — this codebase is entirely oklch — so parsing a colour as RGB yields
 * nonsense. Assigning it to `ctx.fillStyle` and reading one pixel back is the
 * only thing that resolves whatever the browser understands, including the
 * `color-mix()` the browser has already flattened into `oklab()`.
 *
 * WHAT IT FOUND. Three real AAA failures hiding behind a null-ratio pass,
 * including the /pricing "Select" buy button at 4.21:1 (#778).
 *
 * @module tests/e2e/utils/contrast-fallback
 */

/** Why a node could not be measured even by this fallback. */
export type UnresolvableReason =
  /** A `url()` layer — an image cannot be reduced to a colour. */
  | 'background-image-url'
  /** A background stack that resolved to no colour at all. */
  | 'no-background'
  /** `background-clip: text` with no gradient to take the text colour from. */
  | 'no-foreground';

export interface FallbackRow {
  selector: string;
  /** Stable-ish identity for allowlisting: tag + first classes. Never a positional selector. */
  signature: string;
  text: string;
  kind: 'measured' | 'not-visible' | 'unresolvable';
  reason?: UnresolvableReason;
  /** Worst ratio across every gradient stop. Present when kind === 'measured'. */
  ratio?: number;
  /** 7, or 4.5 for WCAG "large" text. */
  required?: number;
  mode?: 'own-gradient' | 'ancestor-gradient' | 'bg-clip-text';
  fg?: string;
  bg?: string;
  /** For `background-image-url`: the base colour under the image, for triage only. */
  baseColorRatio?: number;
}

/**
 * Runs IN THE PAGE. Pass it straight to `page.evaluate(measureNullRatioNodes, targets)`.
 *
 * Self-contained by necessity — Playwright serialises this function, so it cannot
 * close over anything in module scope. Deliberately not `eval`'d.
 */
export function measureNullRatioNodes(targets: string[]): FallbackRow[] {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;

  /** Any CSS colour → rgb, via the browser. The only thing that handles oklch(). */
  const rgbOf = (css: string): [number, number, number] | null => {
    if (!css) return null;
    ctx.clearRect(0, 0, 1, 1);
    // Seed with a known value: an INVALID assignment leaves fillStyle unchanged,
    // so without this an unparseable colour would silently inherit the last one.
    ctx.fillStyle = '#000000';
    const before = ctx.fillStyle;
    ctx.fillStyle = css;
    if (ctx.fillStyle === before && !/^#0{3,8}$|black/i.test(css.trim())) {
      // Could not be parsed — genuinely unknown, not black.
      return null;
    }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };

  const luminance = ([r, g, b]: [number, number, number]): number => {
    const f = (c: number) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const ratioOf = (
    a: [number, number, number],
    b: [number, number, number]
  ): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * Split a background-image value into its TOP-LEVEL comma-separated layers.
   *
   * Paren-depth counting, not a regex. The regex version — `/,(?![^()]*\))/` —
   * also split inside `rgba(0, 0, 0, 0)`, shredding one chevron gradient into
   * fragments. The transparent stop landed in one fragment and the opaque arrow
   * colour in another, so the arrow fragment looked like a legitimate surface
   * and was measured as the text's background: fg and bg both resolved to
   * `--color-base-content` and scored a perfect 1:1 on selects that are
   * perfectly legible. A splitter that cannot see its own nesting produces
   * confident nonsense.
   */
  const layersOf = (v: string): string[] => {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < (v || '').length; i++) {
      const ch = v[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        out.push(v.slice(start, i).trim());
        start = i + 1;
      }
    }
    if (v) out.push(v.slice(start).trim());
    return out.filter(Boolean);
  };

  /**
   * A layer list of nothing but `none` is NOT a background image.
   *
   * `backgroundImage` on a multi-layer element reads `"none, none"`, which is
   * not equal to `'none'`. Treating that as a gradient sent 30 nodes down the
   * stop-parsing path, found no colours, and reported them unresolvable — a
   * self-inflicted blind spot inside the fix for a blind spot.
   */
  const hasBgImage = (v: string): boolean =>
    !!v && v !== 'none' && layersOf(v).some((layer) => layer !== 'none');

  const hasUrlLayer = (v: string): boolean => /(^|[\s,])url\(/.test(v || '');

  /** Every colour token in a computed gradient. color-mix() is already flattened by here. */
  const gradientStops = (v: string): string[] => {
    const out: string[] = [];
    const re =
      /(oklch|oklab|rgba?|hsla?|lab|lch|color)\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-fA-F]{3,8}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(v))) out.push(m[0]);
    return out;
  };

  /**
   * A LAYER WITH A TRANSPARENT STOP IS A SHAPE, NOT A SURFACE.
   *
   * DaisyUI draws the `<select>` dropdown chevron as two hard-stop gradients:
   *
   *   linear-gradient(45deg,  rgba(0,0,0,0) 50%, oklch(0.9288 …) 0px),
   *   linear-gradient(135deg, oklch(0.9288 …) 50%, rgba(0,0,0,0) …)
   *
   * That arrow is the SAME colour as the label text, so worst-of-stops scored a
   * perfect 1:1 and reported "invisible text" on four selects that are perfectly
   * legible — verified by screenshot. The chevron is a glyph in the corner; the
   * text sits on the element's opaque background-color.
   *
   * A gradient that genuinely forms the surface behind text (the pricing CTA, the
   * hero wash) interpolates between OPAQUE stops and covers the box. One carrying
   * a transparent stop only partially covers it, so it cannot be assumed to be
   * what the text sits on. Those layers are dropped; the surface underneath is
   * used instead.
   */
  const isSurfaceLayer = (layer: string): boolean =>
    layer !== 'none' &&
    !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|(^|[\s,(])transparent([\s,)]|$)/.test(
      layer
    );

  /** Stops from only those layers that actually form a surface. */
  const surfaceStops = (v: string): string[] =>
    layersOf(v)
      .filter(isSurfaceLayer)
      .flatMap((layer) => gradientStops(layer));

  /** Nearest ancestor background that resolves to actual colours. */
  const ancestorBg = (el: Element): [number, number, number][] => {
    let p = el.parentElement;
    let depth = 0;
    while (p && depth < 20) {
      const cs = getComputedStyle(p);
      if (hasBgImage(cs.backgroundImage)) {
        const s = surfaceStops(cs.backgroundImage)
          .map(rgbOf)
          .filter(Boolean) as [number, number, number][];
        if (s.length) return s;
      }
      if (!/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) {
        const c = rgbOf(cs.backgroundColor);
        if (c) return [c];
      }
      p = p.parentElement;
      depth++;
    }
    const body = rgbOf(getComputedStyle(document.body).backgroundColor);
    return body ? [body] : [];
  };

  const rows: FallbackRow[] = [];

  for (const selector of targets) {
    let el: Element | null = null;
    try {
      el = document.querySelector(selector);
    } catch {
      /* an axe selector we cannot re-resolve */
    }
    const signatureOf = (e: Element | null) =>
      e
        ? `${e.tagName.toLowerCase()}.${(e.className || '')
            .toString()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 3)
            .join('.')}`
        : selector;

    if (!el) {
      rows.push({
        selector,
        signature: selector,
        text: '',
        kind: 'unresolvable',
        reason: 'no-background',
      });
      continue;
    }

    const cs = getComputedStyle(el);
    const signature = signatureOf(el);
    const text = (el.textContent || '').trim().slice(0, 40);

    // An invisible element has no contrast to get wrong.
    //
    // NOT CURRENTLY LOAD-BEARING, AND SAID SO HONESTLY. This was added after the
    // colourblind <select> on /accessibility/ measured a perfect 1:1 — foreground
    // identical to background, catastrophic-looking, and Playwright could not even
    // scroll to it. The REAL cause turned out to be elsewhere: that 1:1 came from
    // reading a decorative chevron gradient as the text's background, which
    // isSurfaceLayer now filters. Deleting this guard entirely changes no result
    // today — verified by mutation, 7 passed either way.
    //
    // Kept because the principle holds regardless of whether a case currently
    // exercises it, and because measuring a hidden element can only ever produce a
    // number nobody can act on. But it is documented as unproven rather than
    // credited with a fix it did not make.
    if (
      el.getClientRects().length === 0 ||
      cs.visibility === 'hidden' ||
      cs.display === 'none' ||
      Number(cs.opacity) === 0
    ) {
      rows.push({ selector, signature, text, kind: 'not-visible' });
      continue;
    }

    const clipsToText =
      cs.webkitBackgroundClip === 'text' ||
      (cs as unknown as { backgroundClip?: string }).backgroundClip === 'text';
    const fillTransparent = /rgba\(0, 0, 0, 0\)|transparent/.test(
      cs.webkitTextFillColor || ''
    );

    let fgs: [number, number, number][];
    let bgs: [number, number, number][];
    let mode: FallbackRow['mode'];

    if (clipsToText && fillTransparent) {
      // INVERTED: the gradient IS the text. Stops are the foreground; the
      // background is whatever the element sits on.
      mode = 'bg-clip-text';
      fgs = surfaceStops(cs.backgroundImage).map(rgbOf).filter(Boolean) as [
        number,
        number,
        number,
      ][];
      bgs = ancestorBg(el);
    } else if (hasBgImage(cs.backgroundImage)) {
      mode = 'own-gradient';
      const fg = rgbOf(cs.color);
      fgs = fg ? [fg] : [];
      bgs = surfaceStops(cs.backgroundImage).map(rgbOf).filter(Boolean) as [
        number,
        number,
        number,
      ][];
      // Every layer was decoration — a chevron, an underline, a texture. The
      // real surface is then the element's own background-color, or whatever it
      // sits on when that is transparent.
      if (!bgs.length) {
        const own = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)
          ? null
          : rgbOf(cs.backgroundColor);
        bgs = own ? [own] : ancestorBg(el);
      }
    } else {
      mode = 'ancestor-gradient';
      const fg = rgbOf(cs.color);
      fgs = fg ? [fg] : [];
      bgs = ancestorBg(el);
    }

    if (!fgs.length || !bgs.length) {
      // A url() layer is the one background this technique genuinely cannot
      // reduce to a colour. Report the base background-color underneath it for
      // triage — but do NOT treat that as the measurement, because the image
      // sits on top of it and is unaccounted for. Rounding it to a pass would
      // be #459 with extra steps.
      const reason: UnresolvableReason = hasUrlLayer(cs.backgroundImage)
        ? 'background-image-url'
        : !fgs.length
          ? 'no-foreground'
          : 'no-background';
      let baseColorRatio: number | undefined;
      const fg = rgbOf(cs.color);
      const base = rgbOf(cs.backgroundColor);
      if (fg && base)
        baseColorRatio = Math.round(ratioOf(fg, base) * 100) / 100;
      rows.push({
        selector,
        signature,
        text,
        kind: 'unresolvable',
        reason,
        mode,
        baseColorRatio,
      });
      continue;
    }

    let worst = Infinity;
    let worstFg = fgs[0];
    let worstBg = bgs[0];
    for (const f of fgs) {
      for (const b of bgs) {
        const r = ratioOf(f, b);
        if (r < worst) {
          worst = r;
          worstFg = f;
          worstBg = b;
        }
      }
    }

    // WCAG "large text": >= 24px, or >= 18.66px when bold. Everything else needs
    // the full AAA 7:1.
    const px = parseFloat(cs.fontSize) || 16;
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);

    rows.push({
      selector,
      signature,
      text,
      kind: 'measured',
      mode,
      ratio: Math.round(worst * 100) / 100,
      required: large ? 4.5 : 7,
      fg: `rgb(${worstFg.join(',')})`,
      bg: `rgb(${worstBg.join(',')})`,
    });
  }

  return rows;
}

/**
 * Vendor-owned elements whose contrast we neither set nor can change.
 *
 * The route-level `EXCLUDED` map in color-contrast.spec.ts already takes this
 * position for `/chatt` ("Cesium error panel is vendor markup"). Leaflet's
 * attribution control is the same category — third-party chrome, rendered by the
 * map library, styled by it. Excluding the ELEMENT keeps the rest of /map
 * measured, which excluding the route would throw away.
 *
 * This is not a threshold and not a filter on our own UI: adding anything here
 * means asserting we do not own that element's colours.
 */
export const VENDOR_EXCLUDED: ReadonlyArray<{
  selectorFragment: string;
  why: string;
}> = [
  {
    // 'leaflet' not 'leaflet-control-attribution': the failing nodes are the
    // links INSIDE it, and axe addresses one of them as `a[href$="leafletjs.com"]`
    // — which never contains the container's class name.
    selectorFragment: 'leaflet',
    why:
      "Leaflet's own attribution control. Measured 4.94:1 on its 'Leaflet' and " +
      "'OpenStreetMap' links, which Leaflet styles itself — we neither set those " +
      'colours nor can change them without patching vendor CSS. Same call the ' +
      "spec's EXCLUDED map already makes for Cesium's error panel, but scoped to " +
      'the element so the rest of /map stays measured.',
  },
];

/**
 * Signatures allowed to remain unmeasurable, each with the reason.
 *
 * ASSERTED AS A SET, NOT A COUNT. A count lets one unresolvable node appear as
 * another is fixed and stay green throughout. Matching the set means a NEW
 * unmeasurable element fails even while the total holds steady.
 */
export const UNRESOLVABLE_ALLOWLIST: ReadonlyArray<{
  signature: RegExp;
  reason: UnresolvableReason;
  why: string;
}> = [
  {
    // ANY element carrying DaisyUI's .btn — not just <button>. The first version
    // of this said /^button\.btn\./ and the gate immediately caught
    // `a.btn.btn-primary "Go Home"`, which is the allowlist working: a category
    // written too narrowly fails loudly instead of silently covering less.
    signature: /^[a-z]+\.btn(\.|$)/,
    reason: 'background-image-url',
    why:
      'DaisyUI layers an SVG data-URI texture over .btn variants, so the computed ' +
      'background is `none, url(data:image/svg+xml,...)`. An image cannot be ' +
      'reduced to a colour by stop inspection. The base background-color IS ' +
      'reported alongside for triage, but is deliberately not accepted as the ' +
      'measurement — the image sits on top of it and is unaccounted for. ' +
      'Resolving this properly needs pixel readback of the rendered element (#459).',
  },
];

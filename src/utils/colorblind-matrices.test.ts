import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  COLORBLIND_MATRICES,
  getColorblindMatrixString,
  isValidColorMatrix,
  matrixToSVGString,
  measureFilterPerformance,
  type ColorMatrix,
} from './colorblind-matrices';
import { ColorblindType } from './colorblind';

/**
 * `colorblind-matrices.ts` had no test of its own (#886).
 *
 * The only existing coverage lives in `ColorblindFilters.test.tsx`, and it is
 * circular: it asserts the rendered `<feColorMatrix values>` equals
 * `matrixToSVGString(COLORBLIND_MATRICES[type])` — computing the expectation
 * with the very function under test. Break the flattening and that assertion
 * still passes, because both sides break together. So the exact serialised
 * strings are pinned here by hand instead.
 *
 * The other thing that file cannot see is what the numbers MEAN. These are
 * daltonization (correction) matrices, not simulation matrices — the module
 * docstring is explicit about that — so the behavioural tests below apply each
 * matrix to a colour and assert where that colour lands, which is the only way
 * a mis-transcribed coefficient shows up as anything other than a different
 * string.
 */

const ALL_TYPES = Object.values(ColorblindType);

/** Rows are [R', G', B', A'] and columns are [R, G, B, A, offset]. */
type Rgba = [number, number, number, number];

/**
 * Apply a 4x5 matrix to an RGBA colour exactly as SVG `feColorMatrix` does.
 * Not imported from the module — the module has no such function; this is the
 * spec of what the exported numbers are asked to do.
 */
function applyMatrix(matrix: ColorMatrix, [r, g, b, a]: Rgba): Rgba {
  return matrix.map(
    (row) => row[0] * r + row[1] * g + row[2] * b + row[3] * a + row[4]
  ) as Rgba;
}

/** A well-formed matrix that is not one of the built-ins. */
function validMatrix(): ColorMatrix {
  return [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
  ];
}

describe('matrixToSVGString', () => {
  it('flattens the identity matrix to twenty space-separated numbers', () => {
    // Pinned by hand. The separator between ROWS is also a single space —
    // feColorMatrix takes one flat list of 20 numbers, not four groups.
    expect(matrixToSVGString(COLORBLIND_MATRICES[ColorblindType.NONE])).toBe(
      '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0'
    );
  });

  it('serialises fractional coefficients without padding or rounding', () => {
    expect(
      matrixToSVGString(COLORBLIND_MATRICES[ColorblindType.PROTANOPIA])
    ).toBe('0 1.05 0 0 0 0 1 0 0 0 0.5 0 0.5 0 0 0 0 0 1 0');
  });

  it('serialises the constant offset column, which only achromatopsia uses', () => {
    expect(
      matrixToSVGString(COLORBLIND_MATRICES[ColorblindType.ACHROMATOPSIA])
    ).toBe(
      '0.299 0.587 0.114 0 0.1 0.299 0.587 0.114 0 0.1 0.299 0.587 0.114 0 0.1 0 0 0 1 0'
    );
  });

  it('keeps the minus sign on negative coefficients', () => {
    // A dropped sign here would invert achromatomaly's saturation boost into a
    // wash, and the string would still parse as valid SVG.
    expect(
      matrixToSVGString(COLORBLIND_MATRICES[ColorblindType.ACHROMATOMALY])
    ).toBe('1.2 -0.1 -0.1 0 0 -0.1 1.2 -0.1 0 0 -0.1 -0.1 1.2 0 0 0 0 0 1 0');
  });

  it('emits exactly 20 finite numbers for every built-in matrix', () => {
    for (const type of ALL_TYPES) {
      const tokens = matrixToSVGString(COLORBLIND_MATRICES[type]).split(' ');
      expect(tokens, type).toHaveLength(20);
      for (const token of tokens) {
        expect(Number.isFinite(Number(token)), `${type}: ${token}`).toBe(true);
      }
    }
  });

  it('preserves row order, so the flattened string is R then G then B then A', () => {
    const ordered: ColorMatrix = [
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20],
    ];
    expect(matrixToSVGString(ordered)).toBe(
      '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20'
    );
  });

  it('renders zero as "0" and negative zero as "0"', () => {
    // Surprise worth pinning: `(-0).toString()` is "0", so a sign flip on a zero
    // coefficient is invisible in the output. Documented, not a defect.
    const zeros: ColorMatrix = [
      [-0, 0, 0, 0, 0],
      [0, -0, 0, 0, 0],
      [0, 0, -0, 0, 0],
      [0, 0, 0, -0, 0],
    ];
    expect(matrixToSVGString(zeros)).toBe(
      '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0'
    );
  });
});

describe('getColorblindMatrixString', () => {
  it('returns the flattened identity for NONE', () => {
    // NONE is never rendered as an SVG filter (ColorblindFilters skips it), but
    // if it ever were, it must be a no-op.
    expect(getColorblindMatrixString(ColorblindType.NONE)).toBe(
      '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0'
    );
  });

  it.each([
    [
      ColorblindType.PROTANOPIA,
      '0 1.05 0 0 0 0 1 0 0 0 0.5 0 0.5 0 0 0 0 0 1 0',
    ],
    [
      ColorblindType.PROTANOMALY,
      '0.5 0.5 0 0 0 0 1.2 0 0 0 0.2 0 0.8 0 0 0 0 0 1 0',
    ],
    [
      ColorblindType.DEUTERANOPIA,
      '1 0 0 0 0 0.5 0 0.5 0 0 0 0.5 0.5 0 0 0 0 0 1 0',
    ],
    [
      ColorblindType.DEUTERANOMALY,
      '1.2 0 0 0 0 0.2 0.8 0 0 0 0 0.2 0.8 0 0 0 0 0 1 0',
    ],
    [
      ColorblindType.TRITANOPIA,
      '1 0 0.3 0 0 0 1 0.3 0 0 0 0 0.4 0 0 0 0 0 1 0',
    ],
    [
      ColorblindType.TRITANOMALY,
      '1 0 0.2 0 0 0 1 0.2 0 0 0 0 1.4 0 0 0 0 0 1 0',
    ],
  ])('serialises %s to its published filter values', (type, expected) => {
    expect(getColorblindMatrixString(type)).toBe(expected);
  });

  it('produces a distinct string for every type, so no two modes look alike', () => {
    // Two modes sharing a matrix would give a user who switched between them no
    // visible feedback at all — the toggle would appear broken, not the filter.
    const strings = ALL_TYPES.map((t) => getColorblindMatrixString(t));
    expect(new Set(strings).size).toBe(ALL_TYPES.length);
  });

  it('leaves only NONE as a no-op', () => {
    const identity = getColorblindMatrixString(ColorblindType.NONE);
    for (const type of ALL_TYPES) {
      if (type === ColorblindType.NONE) continue;
      expect(getColorblindMatrixString(type), type).not.toBe(identity);
    }
  });
});

describe('COLORBLIND_MATRICES', () => {
  it('has an entry for every colorblind type and no extras', () => {
    // ColorblindFilters indexes this by type inside a `.map`. A missing key
    // renders `values="undefined"` — an invalid filter, silently.
    expect(new Set(Object.keys(COLORBLIND_MATRICES))).toEqual(
      new Set(ALL_TYPES as string[])
    );
  });

  it('is 4 rows of 5 for every type', () => {
    for (const type of ALL_TYPES) {
      const matrix = COLORBLIND_MATRICES[type];
      expect(matrix, type).toHaveLength(4);
      for (const row of matrix) {
        expect(row, type).toHaveLength(5);
      }
    }
  });

  it('passes its own validator for every type', () => {
    for (const type of ALL_TYPES) {
      expect(isValidColorMatrix(COLORBLIND_MATRICES[type]), type).toBe(true);
    }
  });

  it('keeps alpha untouched: the last row is always [0, 0, 0, 1, 0]', () => {
    for (const type of ALL_TYPES) {
      expect(COLORBLIND_MATRICES[type][3], type).toEqual([0, 0, 0, 1, 0]);
    }
  });

  it('never feeds alpha into a colour channel', () => {
    // Column index 3 is the alpha coefficient. Non-zero there would make a
    // translucent element's HUE depend on its opacity.
    for (const type of ALL_TYPES) {
      for (const row of COLORBLIND_MATRICES[type].slice(0, 3)) {
        expect(row[3], type).toBe(0);
      }
    }
  });

  it('uses a constant offset only for achromatopsia', () => {
    // The source comment calls this a "slight brightness boost". It is the only
    // matrix in the table with a non-zero column 4, and that asymmetry is
    // deliberate rather than a transcription slip.
    for (const type of ALL_TYPES) {
      const offsets = COLORBLIND_MATRICES[type].map((row) => row[4]);
      if (type === ColorblindType.ACHROMATOPSIA) {
        expect(offsets).toEqual([0.1, 0.1, 0.1, 0]);
      } else {
        expect(offsets, type).toEqual([0, 0, 0, 0]);
      }
    }
  });

  it('gives NONE the exact identity matrix', () => {
    expect(COLORBLIND_MATRICES[ColorblindType.NONE]).toEqual([
      [1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
    ]);
  });
});

describe('COLORBLIND_MATRICES applied to colours', () => {
  const RED: Rgba = [1, 0, 0, 1];
  const GREEN: Rgba = [0, 1, 0, 1];
  const BLUE: Rgba = [0, 0, 1, 1];

  it('leaves every colour untouched under NONE', () => {
    for (const colour of [RED, GREEN, BLUE, [0.2, 0.4, 0.6, 0.8] as Rgba]) {
      expect(
        applyMatrix(COLORBLIND_MATRICES[ColorblindType.NONE], colour)
      ).toEqual(colour);
    }
  });

  it('preserves the input alpha under every type', () => {
    for (const type of ALL_TYPES) {
      const out = applyMatrix(COLORBLIND_MATRICES[type], [0.9, 0.3, 0.1, 0.25]);
      expect(out[3], type).toBe(0.25);
    }
  });

  it('shifts protanopia red into blue, dropping it from the red channel', () => {
    // The comment says "Mix red into blue for distinction" — and the red row's
    // own red coefficient is 0, so a pure red really does render with no red at
    // all. Surprising, but it is what makes red distinguishable from black for
    // a protanope: the blue channel carries it.
    expect(
      applyMatrix(COLORBLIND_MATRICES[ColorblindType.PROTANOPIA], RED)
    ).toEqual([0, 0, 0.5, 1]);
  });

  it('shifts deuteranopia green into blue', () => {
    expect(
      applyMatrix(COLORBLIND_MATRICES[ColorblindType.DEUTERANOPIA], GREEN)
    ).toEqual([0, 0, 0.5, 1]);
  });

  it('spreads tritanopia blue across red and green while damping blue', () => {
    const [r, g, b] = applyMatrix(
      COLORBLIND_MATRICES[ColorblindType.TRITANOPIA],
      BLUE
    );
    expect([r, g, b]).toEqual([0.3, 0.3, 0.4]);
  });

  it('collapses achromatopsia to a single grey level plus a fixed boost', () => {
    for (const colour of [RED, GREEN, BLUE]) {
      const [r, g, b] = applyMatrix(
        COLORBLIND_MATRICES[ColorblindType.ACHROMATOPSIA],
        colour
      );
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
    // Rec.601 luma of pure red (0.299) plus the 0.1 offset.
    expect(
      applyMatrix(COLORBLIND_MATRICES[ColorblindType.ACHROMATOPSIA], RED)[0]
    ).toBeCloseTo(0.399, 10);
    // White clips past 1.0 because of the offset — the boost is unconditional.
    expect(
      applyMatrix(
        COLORBLIND_MATRICES[ColorblindType.ACHROMATOPSIA],
        [1, 1, 1, 1]
      )[0]
    ).toBeCloseTo(1.1, 10);
  });

  it('keeps achromatomaly luminance-neutral on grey', () => {
    // Each row sums to 1.2 - 0.1 - 0.1 = 1, so grey passes through unchanged
    // and only saturation is boosted.
    const [r, g, b] = applyMatrix(
      COLORBLIND_MATRICES[ColorblindType.ACHROMATOMALY],
      [0.5, 0.5, 0.5, 1]
    );
    expect(r).toBeCloseTo(0.5, 10);
    expect(g).toBeCloseTo(0.5, 10);
    expect(b).toBeCloseTo(0.5, 10);
  });

  it('pushes achromatomaly saturated colours past the 0-1 range', () => {
    // 1.2 on the diagonal means pure red leaves at 1.2 and the other channels
    // go negative. The browser clamps; the matrix does not.
    expect(
      applyMatrix(COLORBLIND_MATRICES[ColorblindType.ACHROMATOMALY], RED)
    ).toEqual([1.2, -0.1, -0.1, 1]);
  });
});

describe('isValidColorMatrix', () => {
  it('accepts a well-formed matrix', () => {
    expect(isValidColorMatrix(validMatrix())).toBe(true);
  });

  it('accepts arbitrary colour coefficients as long as the alpha row is intact', () => {
    const wild = validMatrix();
    wild[0] = [-5, 12.5, 0.001, 0, 3];
    expect(isValidColorMatrix(wild)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a plain object', {}],
    ['a string', '1 0 0 0 0'],
    ['a number', 4],
    ['an empty array', []],
  ])('rejects %s', (_label, value) => {
    expect(isValidColorMatrix(value as unknown as ColorMatrix)).toBe(false);
  });

  it('rejects a matrix with three rows', () => {
    expect(
      isValidColorMatrix(validMatrix().slice(0, 3) as unknown as ColorMatrix)
    ).toBe(false);
  });

  it('rejects a matrix with five rows, even if the first four are valid', () => {
    const tooMany = [...validMatrix(), [0, 0, 0, 1, 0]];
    expect(isValidColorMatrix(tooMany as unknown as ColorMatrix)).toBe(false);
  });

  it('rejects a row that is not an array', () => {
    const broken = validMatrix();
    (broken as unknown as unknown[])[1] = '0 1 0 0 0';
    expect(isValidColorMatrix(broken)).toBe(false);
  });

  it.each([
    ['four', [0, 1, 0, 0]],
    ['six', [0, 1, 0, 0, 0, 0]],
    ['zero', []],
  ])('rejects a row of %s values', (_label, row) => {
    const broken = validMatrix();
    (broken as unknown as unknown[])[1] = row;
    expect(isValidColorMatrix(broken)).toBe(false);
  });

  it.each([
    ['a numeric string', '1'],
    ['null', null],
    ['undefined', undefined],
    ['a boolean', true],
    ['NaN', NaN],
  ])('rejects %s inside a row', (_label, value) => {
    const broken = validMatrix();
    (broken[0] as unknown as unknown[])[2] = value;
    expect(isValidColorMatrix(broken)).toBe(false);
  });

  it.each([
    ['R coefficient', 0, 1],
    ['G coefficient', 1, 1],
    ['B coefficient', 2, 1],
    ['A coefficient', 3, 0.5],
    ['constant offset', 4, 0.1],
  ])(
    'rejects an alpha row whose %s is disturbed',
    (_label, index, badValue) => {
      const broken = validMatrix();
      broken[3][index as 0 | 1 | 2 | 3 | 4] = badValue;
      expect(isValidColorMatrix(broken)).toBe(false);
    }
  );

  it('rejects an alpha row that drops alpha entirely', () => {
    const broken = validMatrix();
    broken[3] = [0, 0, 0, 0, 0];
    expect(isValidColorMatrix(broken)).toBe(false);
  });

  it('accepts a negative-zero alpha row, because -0 === 0', () => {
    // Documented surprise: strict equality treats -0 as 0, so this passes.
    const signed = validMatrix();
    signed[3] = [-0, -0, -0, 1, -0];
    expect(isValidColorMatrix(signed)).toBe(true);
  });

  it('ACCEPTS Infinity, because the check is isNaN and not isFinite', () => {
    // Surprising and tested as-is (not "fixed"): the guard is
    // `typeof value !== 'number' || isNaN(value)`, and Infinity clears both.
    // An Infinity coefficient serialises to the string "Infinity", which SVG
    // cannot parse — so a caller cannot rely on `true` here meaning renderable.
    const infinite = validMatrix();
    infinite[0] = [Infinity, 0, 0, 0, 0];
    expect(isValidColorMatrix(infinite)).toBe(true);
    expect(matrixToSVGString(infinite).startsWith('Infinity')).toBe(true);
  });

  it('rejects a matrix whose only fault is a NaN in the alpha row', () => {
    const broken = validMatrix();
    broken[3] = [0, 0, 0, NaN, 0];
    expect(isValidColorMatrix(broken)).toBe(false);
  });
});

describe('measureFilterPerformance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the elapsed time between the two clock reads', () => {
    const now = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(175.5);

    const result = measureFilterPerformance(
      ColorblindType.DEUTERANOPIA,
      () => {}
    );

    expect(result.applicationTime).toBe(75.5);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it('echoes back the type it was given', () => {
    const result = measureFilterPerformance(
      ColorblindType.TRITANOMALY,
      () => {}
    );
    expect(result.type).toBe(ColorblindType.TRITANOMALY);
  });

  it('stamps the wall-clock time from Date.now, not the performance clock', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.spyOn(Date, 'now').mockReturnValue(1_767_225_600_000);

    const result = measureFilterPerformance(ColorblindType.NONE, () => {});

    expect(result.timestamp).toBe(1_767_225_600_000);
  });

  it('invokes the callback exactly once, between the two clock reads', () => {
    // The ordering is the whole point of the function: a callback run before
    // the start read or after the end read would time nothing, and the returned
    // number would still look plausible.
    const now = vi.spyOn(performance, 'now');
    let clockReadsAtCallTime = -1;
    const applyFn = vi.fn(() => {
      clockReadsAtCallTime = now.mock.calls.length;
    });

    measureFilterPerformance(ColorblindType.PROTANOMALY, applyFn);

    expect(applyFn).toHaveBeenCalledTimes(1);
    expect(clockReadsAtCallTime).toBe(1);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it('measures real work as a non-negative finite duration', () => {
    const result = measureFilterPerformance(
      ColorblindType.ACHROMATOPSIA,
      () => {
        let sink = 0;
        for (let i = 0; i < 10_000; i++) sink += i;
        return sink;
      }
    );

    expect(Number.isFinite(result.applicationTime)).toBe(true);
    expect(result.applicationTime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeGreaterThan(1_600_000_000_000);
  });

  it('lets a thrown callback propagate and records nothing', () => {
    // No try/finally in the source, so a failing filter application yields no
    // measurement at all rather than a zero. Tested as-is.
    const boom = new Error('filter application failed');
    expect(() =>
      measureFilterPerformance(ColorblindType.PROTANOPIA, () => {
        throw boom;
      })
    ).toThrow(boom);
  });

  it('returns exactly the three documented fields', () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(5).mockReturnValueOnce(9);
    vi.spyOn(Date, 'now').mockReturnValue(42);

    expect(
      measureFilterPerformance(ColorblindType.ACHROMATOMALY, () => {})
    ).toEqual({
      type: ColorblindType.ACHROMATOMALY,
      applicationTime: 4,
      timestamp: 42,
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  TOUCH_TARGET_STANDARDS,
  DEFAULT_TOUCH_TARGET,
  TOUCH_TARGET_CLASSES,
  INTERACTIVE_ELEMENT_SELECTORS,
  validateTouchTarget,
  validateTouchTargetWithTolerance,
  getMinimumSize,
  getMinimumSpacing,
  getInteractiveElementSelector,
} from './touch-targets';

/**
 * `touch-targets.ts` had no unit test (#908), while five E2E specs import from it
 * (`mobile-touch-targets`, `mobile-buttons`, `mobile-footer`, `mobile-form-inputs`,
 * `blog-touch-targets`). Those specs consume the CONSTANTS and measure a live page;
 * none of them ever calls the validators, so the comparison logic in this file has
 * been shipping unexercised.
 *
 * WHAT THIS FILE PINS, and why each part earns a test:
 *
 *   1. THE BOUNDARY. The rule is "44px minimum", and the code says `<`, so 44 PASSES
 *      and 43 fails. Off-by-one here is invisible in review and would either fail
 *      every compliant control or wave through a 43px one. Every validator gets an
 *      explicit 43 / 44 / 45 triple.
 *   2. THE TOLERANCE ARITHMETIC. `validateTouchTargetWithTolerance` subtracts the
 *      tolerance from the requirement, so the real floor at the default tolerance of
 *      1 is 43, not 44. Two functions in one module therefore disagree about 43 ON
 *      PURPOSE — that is the sub-pixel allowance the E2E specs apply by hand.
 *   3. THE TAILWIND COUPLING. `TOUCH_TARGET_CLASSES` restates 44px and 8px as
 *      `min-w-11` / `gap-2`. Nothing in the type system connects the number to the
 *      class, so the numbers are derived from the standard here rather than
 *      hard-coded twice.
 *   4. THE SELECTOR IS CSS. `getInteractiveElementSelector` joins with `', '`; join
 *      with a space instead and you get a valid-but-inert DESCENDANT selector that
 *      matches nothing and turns the whole E2E sweep green. It is exercised against
 *      a real jsdom document, not just string-compared.
 *
 * SURPRISES, tested as-is rather than "fixed" — see the NaN cases at the end.
 */

describe('TOUCH_TARGET_STANDARDS', () => {
  it('pins AAA at the 44px Apple HIG / WCAG 2.2 AAA figure', () => {
    expect(TOUCH_TARGET_STANDARDS.AAA).toEqual({
      minWidth: 44,
      minHeight: 44,
      minSpacing: 8,
      standard: 'WCAG 2.2 Level AAA / Apple HIG',
    });
  });

  it('pins AA at the 24px WCAG 2.2 AA figure with no spacing requirement', () => {
    expect(TOUCH_TARGET_STANDARDS.AA).toEqual({
      minWidth: 24,
      minHeight: 24,
      minSpacing: 0,
      standard: 'WCAG 2.2 Level AA',
    });
  });

  it('keeps AAA strictly stricter than AA on every axis', () => {
    // A relationship rather than a restatement: swapping the two objects, or
    // relaxing AAA toward AA, fails here even though both literals above would
    // still be individually well-formed.
    expect(TOUCH_TARGET_STANDARDS.AAA.minWidth).toBeGreaterThan(
      TOUCH_TARGET_STANDARDS.AA.minWidth
    );
    expect(TOUCH_TARGET_STANDARDS.AAA.minHeight).toBeGreaterThan(
      TOUCH_TARGET_STANDARDS.AA.minHeight
    );
    expect(TOUCH_TARGET_STANDARDS.AAA.minSpacing).toBeGreaterThan(
      TOUCH_TARGET_STANDARDS.AA.minSpacing
    );
  });

  it('is square: width and height minimums match at both levels', () => {
    // `getMinimumSize` returns minWidth only. That is only honest while the two
    // are equal; if a level ever became non-square, that function would start
    // under-reporting the height requirement.
    expect(TOUCH_TARGET_STANDARDS.AAA.minWidth).toBe(
      TOUCH_TARGET_STANDARDS.AAA.minHeight
    );
    expect(TOUCH_TARGET_STANDARDS.AA.minWidth).toBe(
      TOUCH_TARGET_STANDARDS.AA.minHeight
    );
  });

  it('exposes exactly the two compliance levels the validators accept', () => {
    expect(Object.keys(TOUCH_TARGET_STANDARDS).sort()).toEqual(['AA', 'AAA']);
  });
});

describe('DEFAULT_TOUCH_TARGET', () => {
  it('is the AAA standard itself, not a copy that could drift from it', () => {
    expect(DEFAULT_TOUCH_TARGET).toBe(TOUCH_TARGET_STANDARDS.AAA);
    expect(DEFAULT_TOUCH_TARGET.minWidth).toBe(44);
    expect(DEFAULT_TOUCH_TARGET.minSpacing).toBe(8);
  });
});

describe('validateTouchTarget', () => {
  describe('the 44px boundary', () => {
    // This block is the point of the whole ticket. The comparison is `<`, so the
    // minimum itself is COMPLIANT and one pixel under is not.
    it.each([
      [43, 43, false],
      [43.9, 43.9, false],
      [43.999999, 44, false],
      [44, 44, true],
      [44, 43.999999, false],
      [44.000001, 44, true],
      [45, 45, true],
    ])('%sx%s is valid=%s at AAA', (width, height, expected) => {
      expect(validateTouchTarget(width, height).isValid).toBe(expected);
    });

    it('treats the AA minimum of 24 the same way — 24 passes, 23 does not', () => {
      expect(validateTouchTarget(24, 24, 'AA').isValid).toBe(true);
      expect(validateTouchTarget(23, 24, 'AA').isValid).toBe(false);
      expect(validateTouchTarget(24, 23, 'AA').isValid).toBe(false);
    });

    it('fails a 30px control at AAA that the same call passes at AA', () => {
      // The `standard` argument has to actually be read. A 30px target sits
      // between the two floors, so this is the one size that distinguishes them.
      expect(validateTouchTarget(30, 30, 'AAA').isValid).toBe(false);
      expect(validateTouchTarget(30, 30, 'AA').isValid).toBe(true);
    });

    it('defaults to AAA when no standard is passed', () => {
      // ScriptHammer targets AAA; a default of AA would silently halve the rule.
      expect(validateTouchTarget(30, 30)).toEqual(
        validateTouchTarget(30, 30, 'AAA')
      );
      expect(validateTouchTarget(30, 30).requiredWidth).toBe(44);
    });
  });

  describe('the returned report', () => {
    it('echoes the measured and required sizes for a passing target', () => {
      expect(validateTouchTarget(48, 50)).toEqual({
        isValid: true,
        actualWidth: 48,
        actualHeight: 50,
        requiredWidth: 44,
        requiredHeight: 44,
        errors: undefined,
      });
    });

    it('reports the AA requirement when validating against AA', () => {
      expect(validateTouchTarget(48, 50, 'AA')).toEqual({
        isValid: true,
        actualWidth: 48,
        actualHeight: 50,
        requiredWidth: 24,
        requiredHeight: 24,
        errors: undefined,
      });
    });

    it('omits `errors` entirely rather than returning an empty array', () => {
      // Consumers branch on `result.errors` truthiness in the JSDoc example, and
      // an empty array is truthy — returning `[]` would print "Touch target too
      // small: []" for a compliant control.
      const result = validateTouchTarget(44, 44);
      expect(result.errors).toBeUndefined();
      expect(result.errors).not.toEqual([]);
    });

    it('names the failing axis, the measurement and the requirement', () => {
      expect(validateTouchTarget(40, 44).errors).toEqual([
        'Width 40px is less than minimum 44px',
      ]);
      expect(validateTouchTarget(44, 40).errors).toEqual([
        'Height 40px is less than minimum 44px',
      ]);
    });

    it('lists width before height when both axes fail', () => {
      expect(validateTouchTarget(10, 20)).toEqual({
        isValid: false,
        actualWidth: 10,
        actualHeight: 20,
        requiredWidth: 44,
        requiredHeight: 44,
        errors: [
          'Width 10px is less than minimum 44px',
          'Height 20px is less than minimum 44px',
        ],
      });
    });

    it('quotes the AA requirement in the message when validating at AA', () => {
      expect(validateTouchTarget(10, 10, 'AA').errors).toEqual([
        'Width 10px is less than minimum 24px',
        'Height 10px is less than minimum 24px',
      ]);
    });

    it('renders fractional measurements verbatim, not rounded', () => {
      expect(validateTouchTarget(43.5, 44).errors).toEqual([
        'Width 43.5px is less than minimum 44px',
      ]);
    });
  });

  describe('degenerate sizes', () => {
    it('rejects a zero-sized element and says so on both axes', () => {
      const result = validateTouchTarget(0, 0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.actualWidth).toBe(0);
    });

    it('rejects negative sizes and prints the negative number', () => {
      expect(validateTouchTarget(-10, -1).errors).toEqual([
        'Width -10px is less than minimum 44px',
        'Height -1px is less than minimum 44px',
      ]);
    });

    it('accepts Infinity, which is larger than any requirement', () => {
      expect(validateTouchTarget(Infinity, Infinity).isValid).toBe(true);
    });

    it('SURPRISE: NaN measurements are reported as VALID', () => {
      // `NaN < 44` is false, so a failed measurement produces a clean bill of
      // health rather than an error. Tested as-is (this file does not change the
      // module), and worth knowing before anyone feeds it a
      // `getBoundingClientRect()` of a display:none element. Note
      // `validateTouchTargetWithTolerance` does NOT share this behaviour — see
      // its own NaN case below — so the two functions disagree here.
      const result = validateTouchTarget(NaN, NaN);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.actualWidth).toBeNaN();
    });
  });
});

describe('validateTouchTargetWithTolerance', () => {
  it('allows exactly one sub-pixel below the AAA minimum by default', () => {
    // 44 - 1 = 43. This is the whole reason the function exists, and it is the
    // number that differs from `validateTouchTarget`.
    expect(validateTouchTargetWithTolerance(43, 43)).toBe(true);
    expect(validateTouchTarget(43, 43).isValid).toBe(false);
  });

  it.each([
    [42.9, false],
    [42.999999, false],
    [43, true],
    [43.000001, true],
    [44, true],
  ])(
    'a square %spx target is allowed=%s at the default tolerance',
    (px, ok) => {
      expect(validateTouchTargetWithTolerance(px, px)).toBe(ok);
    }
  );

  it('requires BOTH axes to clear the tolerated floor', () => {
    // An `||` here instead of `&&` would pass any element with one long side —
    // a full-width 20px-tall link, for instance.
    expect(validateTouchTargetWithTolerance(100, 42)).toBe(false);
    expect(validateTouchTargetWithTolerance(42, 100)).toBe(false);
    expect(validateTouchTargetWithTolerance(100, 100)).toBe(true);
  });

  it('collapses onto the strict rule when the tolerance is 0', () => {
    expect(validateTouchTargetWithTolerance(43, 43, 'AAA', 0)).toBe(false);
    expect(validateTouchTargetWithTolerance(44, 44, 'AAA', 0)).toBe(true);
  });

  it('applies the tolerance to the AA floor, not a hard-coded 44', () => {
    expect(validateTouchTargetWithTolerance(23, 23, 'AA')).toBe(true);
    expect(validateTouchTargetWithTolerance(22.9, 23, 'AA')).toBe(false);
    // Defaults to AAA, so the same 23px target fails without the level.
    expect(validateTouchTargetWithTolerance(23, 23)).toBe(false);
  });

  it('widens the floor linearly as the tolerance grows', () => {
    expect(validateTouchTargetWithTolerance(40, 40, 'AAA', 4)).toBe(true);
    expect(validateTouchTargetWithTolerance(39.9, 40, 'AAA', 4)).toBe(false);
    expect(validateTouchTargetWithTolerance(0, 0, 'AAA', 44)).toBe(true);
  });

  it('SURPRISE: a negative tolerance TIGHTENS the rule instead of erroring', () => {
    // 44 - (-1) = 45. Nothing validates the argument, so a sign slip silently
    // makes the gate stricter than AAA rather than throwing.
    expect(validateTouchTargetWithTolerance(44, 44, 'AAA', -1)).toBe(false);
    expect(validateTouchTargetWithTolerance(45, 45, 'AAA', -1)).toBe(true);
  });

  it('SURPRISE: a tolerance big enough to go negative admits negative sizes', () => {
    // 44 - 100 = -56, and -10 >= -56. The companion strict validator rejects the
    // same input, which is the safer of the two behaviours.
    expect(validateTouchTargetWithTolerance(-10, -10, 'AAA', 100)).toBe(true);
    expect(validateTouchTarget(-10, -10).isValid).toBe(false);
  });

  it('rejects NaN, unlike the strict validator', () => {
    // `NaN >= 43` is false. Documented next to the strict validator's NaN case
    // because the disagreement is the surprising part, not either half alone.
    expect(validateTouchTargetWithTolerance(NaN, NaN)).toBe(false);
    expect(validateTouchTargetWithTolerance(100, NaN)).toBe(false);
    expect(validateTouchTarget(NaN, NaN).isValid).toBe(true);
  });
});

describe('getMinimumSize', () => {
  it('returns 44 for AAA and 24 for AA', () => {
    expect(getMinimumSize('AAA')).toBe(44);
    expect(getMinimumSize('AA')).toBe(24);
  });

  it('defaults to the AAA figure', () => {
    expect(getMinimumSize()).toBe(44);
  });

  it('tracks the standards table rather than restating it', () => {
    expect(getMinimumSize('AAA')).toBe(TOUCH_TARGET_STANDARDS.AAA.minWidth);
    expect(getMinimumSize('AA')).toBe(TOUCH_TARGET_STANDARDS.AA.minWidth);
  });
});

describe('getMinimumSpacing', () => {
  it('returns 8px between AAA targets', () => {
    expect(getMinimumSpacing('AAA')).toBe(8);
  });

  it('returns exactly 0 for AA — the level imposes no spacing rule', () => {
    // Asserted as the number 0, not as falsiness: `expect(...).toBeFalsy()`
    // would also accept undefined from a missing key.
    const spacing = getMinimumSpacing('AA');
    expect(spacing).toBe(0);
    expect(Number.isNaN(spacing)).toBe(false);
  });

  it('defaults to the AAA figure', () => {
    expect(getMinimumSpacing()).toBe(8);
  });
});

describe('TOUCH_TARGET_CLASSES', () => {
  // Tailwind's default spacing scale is 4px per unit and this repo does not
  // override `--spacing`, so `min-w-11` is 2.75rem = 44px and `gap-2` is 8px.
  const TAILWIND_UNIT_PX = 4;

  it('encodes the AAA pixel minimums as the matching Tailwind scale steps', () => {
    // Derived from the standard, so bumping minWidth to 48 without moving to
    // `min-w-12` fails here — the drift the type system cannot see.
    const { minWidth, minHeight, minSpacing } = TOUCH_TARGET_STANDARDS.AAA;
    expect(TOUCH_TARGET_CLASSES.minWidth).toBe(
      `min-w-${minWidth / TAILWIND_UNIT_PX}`
    );
    expect(TOUCH_TARGET_CLASSES.minHeight).toBe(
      `min-h-${minHeight / TAILWIND_UNIT_PX}`
    );
    expect(TOUCH_TARGET_CLASSES.minSpacing).toBe(
      `gap-${minSpacing / TAILWIND_UNIT_PX}`
    );
  });

  it('pins the literal class names the components and docs are written against', () => {
    // CLAUDE.md tells contributors to use `min-h-11 min-w-11`; these are the
    // strings that must keep matching that instruction.
    expect(TOUCH_TARGET_CLASSES.minWidth).toBe('min-w-11');
    expect(TOUCH_TARGET_CLASSES.minHeight).toBe('min-h-11');
    expect(TOUCH_TARGET_CLASSES.minSpacing).toBe('gap-2');
  });

  it('composes the combined strings from the single-axis ones', () => {
    expect(TOUCH_TARGET_CLASSES.minSize).toBe(
      `${TOUCH_TARGET_CLASSES.minWidth} ${TOUCH_TARGET_CLASSES.minHeight}`
    );
    expect(TOUCH_TARGET_CLASSES.button).toBe(
      `${TOUCH_TARGET_CLASSES.minSize} ${TOUCH_TARGET_CLASSES.minSpacing}`
    );
    expect(TOUCH_TARGET_CLASSES.button).toBe('min-w-11 min-h-11 gap-2');
  });

  it('is space-separated so the values can be dropped into className as-is', () => {
    for (const value of Object.values(TOUCH_TARGET_CLASSES)) {
      expect(value).not.toMatch(/[,;]/);
      expect(value.trim()).toBe(value);
    }
  });
});

describe('INTERACTIVE_ELEMENT_SELECTORS', () => {
  it('covers the element kinds the mobile sweeps are meant to measure', () => {
    expect(INTERACTIVE_ELEMENT_SELECTORS).toContain('button');
    expect(INTERACTIVE_ELEMENT_SELECTORS).toContain('a[href]');
    expect(INTERACTIVE_ELEMENT_SELECTORS).toContain('[role="button"]');
    expect(INTERACTIVE_ELEMENT_SELECTORS).toContain('select');
    expect(INTERACTIVE_ELEMENT_SELECTORS).toContain('textarea');
    expect(INTERACTIVE_ELEMENT_SELECTORS.length).toBeGreaterThanOrEqual(10);
  });

  it('lists no selector twice, which would double-count an element', () => {
    expect(new Set(INTERACTIVE_ELEMENT_SELECTORS).size).toBe(
      INTERACTIVE_ELEMENT_SELECTORS.length
    );
  });

  it('contains only selectors a browser can actually parse', () => {
    for (const selector of INTERACTIVE_ELEMENT_SELECTORS) {
      expect(() => document.querySelectorAll(selector)).not.toThrow();
    }
  });

  it('uses no class-name selectors, which silently stop matching on a rename', () => {
    // #396 in CLAUDE.md: introducing `.sh-btn` alongside `.btn` dropped a mobile
    // sweep from 6 measured targets to 5 with no failure. Tag/role selectors
    // cannot fail that way.
    for (const selector of INTERACTIVE_ELEMENT_SELECTORS) {
      expect(selector).not.toMatch(/\./);
    }
  });
});

describe('getInteractiveElementSelector', () => {
  it('produces the exact comma-separated selector list the E2E sweep queries', () => {
    expect(getInteractiveElementSelector()).toBe(
      'button, a[href], input[type="button"], input[type="submit"], ' +
        'input[type="reset"], [role="button"], [role="link"], label, select, textarea'
    );
  });

  it('separates every entry with ", " — a space alone would mean DESCENDANT', () => {
    // Splitting on the literal CSS separator must return the source list. Join
    // with ' ' instead and this collapses to a single element: the resulting
    // selector is still valid CSS, matches nothing, and the sweep goes green
    // having measured zero controls.
    expect(getInteractiveElementSelector().split(', ')).toEqual([
      ...INTERACTIVE_ELEMENT_SELECTORS,
    ]);
  });

  it('matches every interactive element in a real document and nothing else', () => {
    document.body.innerHTML = `
      <button id="btn">go</button>
      <a id="link" href="/x">x</a>
      <a id="anchor-no-href">no href</a>
      <input id="submit" type="submit" />
      <input id="reset" type="reset" />
      <input id="inputbtn" type="button" />
      <input id="text" type="text" />
      <span id="rolebtn" role="button">span</span>
      <span id="rolelink" role="link">span</span>
      <label id="label" for="text">label</label>
      <select id="select"><option>a</option></select>
      <textarea id="textarea"></textarea>
      <div id="plain">not interactive</div>
      <p id="para">text</p>
    `;

    const matched = Array.from(
      document.querySelectorAll(getInteractiveElementSelector())
    ).map((el) => el.id);

    expect(matched.sort()).toEqual(
      [
        'btn',
        'link',
        'submit',
        'reset',
        'inputbtn',
        'rolebtn',
        'rolelink',
        'label',
        'select',
        'textarea',
      ].sort()
    );

    // The negatives matter as much as the positives: an `a` with no href is not
    // a control, and a bare div/p would flood the sweep with false failures.
    expect(matched).not.toContain('anchor-no-href');
    expect(matched).not.toContain('plain');
    expect(matched).not.toContain('para');

    // KNOWN GAP, asserted so it is deliberate rather than accidental: a plain
    // text input is NOT in the list. Text fields are covered separately by
    // tests/e2e/tests/mobile-form-inputs.spec.ts, which has its own 16px
    // font-size rule for them on top of the size floor.
    expect(matched).not.toContain('text');

    document.body.innerHTML = '';
  });

  it('returns a selector jsdom accepts without throwing', () => {
    expect(() =>
      document.querySelectorAll(getInteractiveElementSelector())
    ).not.toThrow();
  });
});

import React from 'react';
import { ICON_PATHS, type IconName } from './icons';

/**
 * Icon props.
 *
 * `label` is a discriminated union rather than an optional string, on purpose.
 * An icon is either meaningful — and needs an accessible name — or decorative
 * beside adjacent text, and must be hidden from assistive tech. There is no
 * correct third state, so the type does not offer one: omitting `label`
 * requires writing `decorative`, which makes the choice deliberate instead of
 * defaulted.
 *
 * This matters more than usual here. Accessible names are an API in this repo
 * (#377): `performSignIn()` and ~20 specs locate controls by name, and the
 * emoji this set replaced carried theirs explicitly — `CookieConsent` rendered
 * `role="img" aria-label="Cookie"` beside a sentence that already said "We use
 * cookies", so the name simply repeated the copy. Swapping in a silently
 * unlabelled SVG changes what axe and every name-based locator can see, so the
 * choice has to be made per site rather than defaulted.
 */
export type IconProps = {
  /** Which icon to draw. */
  name: IconName;
  /** Additional CSS classes. */
  className?: string;
  /**
   * Rendered size in pixels. Defaults to `1em` so an icon tracks the font size
   * it sits in, including the accessibility font scale.
   */
  size?: number | string;
} & (
  | {
      /** Accessible name. Use when the icon is the only thing conveying meaning. */
      label: string;
      decorative?: never;
    }
  | {
      /** The icon repeats adjacent visible text and must be hidden from AT. */
      decorative: true;
      label?: never;
    }
);

/**
 * A single line icon from the Machine Shop set.
 *
 * @category atomic
 */
export default function Icon({
  name,
  className = '',
  size = '1em',
  ...rest
}: IconProps) {
  const path = ICON_PATHS[name];

  const naming =
    'label' in rest && rest.label
      ? ({ role: 'img', 'aria-label': rest.label } as const)
      : ({ 'aria-hidden': true, focusable: false } as const);

  return (
    <svg
      className={className || undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      // `none` and `currentColor` are what let one icon serve 32 themes and
      // every text colour without a per-theme variant.
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...naming}
    >
      <path d={path} />
    </svg>
  );
}

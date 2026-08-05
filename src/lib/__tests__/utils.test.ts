import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

/**
 * `cn` is fifteen lines and had no test (#535).
 *
 * The interesting part is not that it joins strings — it is the two things it
 * deliberately does NOT do. Its docblock calls it a "simple alternative to
 * clsx/classnames when full functionality isn't needed", and anyone arriving
 * from a codebase where `cn` is `clsx` + `tailwind-merge` will assume conflict
 * resolution they are not getting. Those assumptions are pinned below so the
 * difference fails a test rather than a page.
 */
describe('cn', () => {
  it('joins truthy class names with a single space', () => {
    expect(cn('base-class', 'other-class')).toBe('base-class other-class');
  });

  it('drops every falsy value the signature allows', () => {
    // The `condition && 'class'` idiom yields `false`, and an absent prop
    // yields `undefined` — both must vanish rather than stringify.
    expect(cn('base', false, undefined, null, 'tail')).toBe('base tail');
  });

  it('drops empty strings, so a missing className leaves no double space', () => {
    // `className` defaulting to '' is the common caller shape. '' is falsy, so
    // it is filtered before the join — this is why the output never contains a
    // run of two spaces, and the reason not to "improve" the filter to
    // `!= null`.
    expect(cn('a', '', 'b')).toBe('a b');
    expect(cn('a', '', 'b')).not.toContain('  ');
  });

  it('returns an empty string when nothing survives', () => {
    expect(cn()).toBe('');
    expect(cn(undefined, false, null, '')).toBe('');
  });

  it('does NOT deduplicate, and does NOT resolve Tailwind conflicts', () => {
    // Both are true of tailwind-merge and false here. If either of these ever
    // starts passing, `cn` has quietly become a different function and every
    // call site that relies on last-class-wins ordering needs re-reading.
    expect(cn('p-2', 'p-2')).toBe('p-2 p-2');
    expect(cn('p-2', 'p-4')).toBe('p-2 p-4');
  });

  it('preserves argument order, which is what makes CSS ordering predictable', () => {
    expect(cn('z', 'a', 'm')).toBe('z a m');
  });
});

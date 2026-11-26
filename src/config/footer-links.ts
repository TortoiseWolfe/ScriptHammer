/**
 * The site's footer links, in one place (#301).
 *
 * Two components present these: the global `Footer` (prose — "Made by X for Y",
 * "Built with Z template") and `src/twin/TwinFooter` (a compact glass strip
 * pinned over the full-viewport scene on /chatt and /twins/[slug], where the
 * prose form cannot fit). The PRESENTATIONS are genuinely different and stay
 * separate; the DATA must not, or the two drift.
 *
 * `tests/e2e/tests/mobile-footer.spec.ts` already imports from `@/config/` this
 * way (TOUCH_TARGET_STANDARDS), so the twin strip's spec can import this list
 * and assert the strip carries exactly these hrefs — which is what makes the
 * extraction pay for itself rather than just being tidy.
 */
export const FOOTER_LINKS = [
  { href: 'https://crudgames.com', label: 'CRUDgames.com' },
  { href: 'https://geolarp.com', label: 'geoLARP.com' },
  {
    href: 'https://github.com/TortoiseWolfe/ScriptHammer', // rebrand:keep
    label: 'ScriptHammer', // rebrand:keep
  },
] as const;

/**
 * Where a visitor can get this site's source code. ScriptHammer is AGPL-3.0,
 * and section 13 says users who talk to a modified copy over a network must be
 * offered its source, so both footers carry this link.
 *
 * Deliberately NOT in FOOTER_LINKS: that array is destructured by position in
 * Footer.tsx, and it models brand links, not a licence duty. A fork that
 * changes the code points this at its own repository.
 */
export const SOURCE_LINK = {
  href: 'https://github.com/TortoiseWolfe/ScriptHammer', // rebrand:keep
  label: 'Source code (AGPL-3.0)',
  shortLabel: 'Source',
} as const;

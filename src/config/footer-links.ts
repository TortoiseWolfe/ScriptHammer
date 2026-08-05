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

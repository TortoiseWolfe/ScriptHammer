import React from 'react';
import { FOOTER_LINKS } from '@/config/footer-links';

/**
 * The twin routes' compact footer — a glass strip pinned over the scene (#301).
 *
 * WHY A SECOND COMPONENT INSTEAD OF RESTYLING THE GLOBAL FOOTER.
 * Not principle — content. `Footer` is two stacked <p> of prose ("Made by
 * CRUDgames.com for geoLARP.com" / "Built with ScriptHammer template"): roughly
 * 430px of text at a 390px viewport. On one 44px line, nowrap clips it and wrap
 * blows the height. The only CSS escapes are dropping the ScriptHammer link on
 * mobile or shrinking the type below legibility. And the selectors would have
 * to reach into Footer's internal DOM (`footer > div > p:nth-child(2)`), so any
 * edit there would silently break the twin routes. This is a different
 * presentation, not a restyle. The DATA is shared (@/config/footer-links); only
 * the presentation forks.
 *
 * WHY THE ROUTE'S FOOTER, NOT THE PAGE'S. Rendered by TwinCanvasHost, so one
 * place covers both routes and both renderers. It lives in src/twin/ (flat
 * module, like TwinCanvasHost and renderer-select) rather than src/components/:
 * scripts/validate-structure.js scans src/components only, so this sits outside
 * the 5-file mandate legitimately rather than dodging it.
 *
 * ONE LANDMARK, NOT TWO. globals.css hides [data-site-footer] on these routes
 * in the same rule block that reveals this one, so there is exactly one
 * `contentinfo` — never zero, never two.
 *
 * SIZING. min-h, not h: --font-scale-factor reaches 2.125, at which these three
 * labels are ~500px and must wrap to a second line rather than clip. The links
 * are min-h-11 (44px, CLAUDE.md's touch target) and fill the strip's content
 * box exactly — the same trick Footer.tsx already uses. pb-[env(...)] keeps the
 * content at 44px while the strip itself grows into the iOS home indicator
 * (layout.tsx sets viewportFit:'cover').
 *
 * Z-ORDER. z-50, a peer of the nav: both are global chrome. Above the scene
 * (z-auto), below the tour caption (z-[55], 112px up, so they never meet). The
 * cookie banner (z-[60]) covers this until dismissed on the atlas — accepted;
 * consent outranks a strip of credits.
 */
export function TwinFooter() {
  return (
    <footer
      data-twin-footer
      className="bg-base-100/90 border-base-300 fixed inset-x-0 bottom-0 z-50 min-h-[var(--twin-footer-h)] flex-wrap items-center justify-center gap-x-3 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      {FOOTER_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-hover inline-flex min-h-11 items-center px-1 text-xs font-medium"
        >
          {link.label}
        </a>
      ))}
    </footer>
  );
}

#!/usr/bin/env node
/**
 * Render a talk deck in `docs/talks/` to PDF.
 *
 * WHY THIS EXISTS. The PDF is what gets uploaded to a conference, and a PDF nobody can
 * regenerate is a build output that has been treated as a source — the exact inversion
 * CLAUDE.md warns about under "Generated artifacts are build OUTPUTS, never inputs". The
 * HTML is tracked; the PDF is not, and this makes it on demand.
 *
 * TWO THINGS IT VERIFIES RATHER THAN ASSUMES, both of which have already gone wrong once:
 *
 *   1. THE FONTS ACTUALLY LOADED. The deck links Google Fonts; if the network is down or a
 *      family name is misspelled the browser silently substitutes, and you find out when the
 *      deck is on a projector in Arial.
 *
 *      NOT via `document.fonts.check()` — that returns true whenever the text can be
 *      rendered by ANY font, fallback included, so it passes on a completely broken
 *      `<link>`. Verified: with the family names corrupted it still said yes, while the PDF
 *      shrank from 1.06 MB to 0.84 MB because nothing embedded. This enumerates the
 *      FontFace set and requires each family to be present with `status === 'loaded'`.
 *
 *   2. THE PAGE COUNT MATCHES THE SLIDE COUNT — which catches a slide taller than its
 *      `@page` box splitting across two pages, and a deck that failed to render at all.
 *
 *      It does NOT catch a missing `scroll-snap-type`; print pagination comes from
 *      `page-break-after`, so the PDF is unaffected. Also verified, by removing it. That is
 *      a browsing defect, not an export one, so it is checked in the source instead.
 *
 * Runs inside the dev container, which already has Playwright's chromium. Docker-first —
 * never install browsers on the host.
 *
 * USAGE
 *   docker compose exec scripthammer node scripts/render-talk.mjs why-build-one-app
 *   docker compose exec scripthammer node scripts/render-talk.mjs --all
 */

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const TALKS = path.resolve('docs/talks');

/** Families the deck asks for. A silent fallback is the failure this checks for. */
const REQUIRED_FAMILIES = ['Archivo Black', 'Archivo', 'JetBrains Mono'];

/** The deck's @page size. Overflow is measured at exactly this box. */
const PAGE_MM = { w: 279, h: 157 };

/**
 * Minimum breathing room between the tallest content and the edge of the printed box.
 *
 * Not zero. A slide whose content exactly fills its content box still prints clipped — the
 * measured case was 510px of content in 510px of room, losing the last line's descender.
 */
const MIN_SLACK_PX = 12;

async function render(slug) {
  const src = path.join(TALKS, `${slug}.html`);
  if (!existsSync(src)) throw new Error(`no such talk: ${src}`);

  const out = path.join(TALKS, `${slug}.pdf`);
  const source = readFileSync(src, 'utf8');
  const slidesInSource = (source.match(/class="slide"/g) ?? []).length;

  // `scroll-snap-align` on the children does nothing without `scroll-snap-type` on the
  // scroller. The deck then browses as one continuous scroll while exporting perfectly, so
  // no amount of inspecting the PDF would reveal it. This exact bug shipped once.
  // Match the DECLARATION (`prop:`), not the bare word. The deck carries a comment
  // explaining this very pair, and an `includes()` check matched that prose instead of the
  // CSS — so the guard passed with the property deleted.
  const declares = (prop) => new RegExp(`${prop}\\s*:\\s*\\S`).test(source);
  if (declares('scroll-snap-align') && !declares('scroll-snap-type')) {
    throw new Error(
      'slides use `scroll-snap-align` but no container sets `scroll-snap-type` — the deck ' +
        'will browse as one long scroll. The PDF will look fine, which is the trap.'
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${src}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(2500);

  const loaded = await page.evaluate(() => [
    ...new Set(
      [...document.fonts]
        .filter((f) => f.status === 'loaded')
        .map((f) => f.family)
    ),
  ]);
  const missing = REQUIRED_FAMILIES.filter((f) => !loaded.includes(f));
  if (missing.length) {
    await browser.close();
    throw new Error(
      `fonts did not load: ${missing.join(', ')} (loaded: ${loaded.join(', ') || 'none'})\n` +
        '  The deck would render in a fallback face. Check the network, or the family ' +
        'names in the <link> against the ones the CSS asks for.'
    );
  }

  const slidesInDom = await page.evaluate(
    () => document.querySelectorAll('.slide').length
  );

  // CONTENT MUST FIT THE PAGE BOX, WITH SLACK.
  //
  // The page-count check below cannot see this: `page-break-after: always` emits one page
  // per slide whether the content fits or not, so a too-full slide is silently CLIPPED and
  // the count stays correct. Found by reading the PDF — page 1's terminal block was sliced
  // through `git push`, across 21 perfectly-counted pages.
  //
  // TWO THINGS THIS GETS RIGHT THAT THE FIRST VERSION DID NOT:
  //
  //   `scrollHeight` is useless here. `.slide` is a centred flex column, so overflow escapes
  //   the top as well as the bottom and scrollHeight never reports it — it read 593 of 593
  //   on the clipped slide. The children's real bounds are measured instead.
  //
  //   SLACK, not overflow. Slide 1 measured content of exactly 510px in a 510px content box:
  //   not overflowing, just flush — and the PDF's rounding clipped the last line's
  //   descender. A slide that exactly fills its box prints as a clipped slide, so a margin
  //   is required rather than mere containment.
  const MM = 96 / 25.4;
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({
    width: Math.round(PAGE_MM.w * MM),
    height: Math.round(PAGE_MM.h * MM),
  });
  await page.waitForTimeout(400);

  const tight = await page.evaluate((minSlack) => {
    return [...document.querySelectorAll('.slide')]
      .map((el, i) => {
        const boxH = el.getBoundingClientRect().height;
        // MEASURE THE NATURAL HEIGHT, not the laid-out one. `.slide` is a centred flex
        // column with a fixed height, so the children's rects are CLAMPED to the box —
        // the measured slack pinned at exactly 0 whether the content fitted or
        // overflowed, which made the first version of this check useless in both
        // directions. Releasing the height first is what makes the number mean anything.
        const prevH = el.style.height;
        const prevMin = el.style.minHeight;
        // BOTH must be released. `.slide` sets `min-height: 157mm` as well as `height`, so
        // freeing only `height` leaves the floor in place and every slide reports exactly
        // 0px of slack — including the near-empty closing slide, which is how this was
        // caught.
        el.style.height = 'auto';
        el.style.minHeight = '0';
        const natural = el.scrollHeight;
        el.style.height = prevH;
        el.style.minHeight = prevMin;
        return {
          i: i + 1,
          slack: Math.round(boxH - natural),
          title: (el.querySelector('h1, h2')?.textContent ?? '(no heading)')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 44),
        };
      })
      .filter((s) => s.slack < minSlack);
  }, MIN_SLACK_PX);

  await page.emulateMedia({ media: null });
  await page.setViewportSize({ width: 1280, height: 720 });

  if (tight.length) {
    await browser.close();
    throw new Error(
      `${tight.length} slide(s) have too little room and will be CLIPPED in the PDF ` +
        `(need ${MIN_SLACK_PX}px of slack):\n` +
        tight
          .map(
            (t) =>
              `    slide ${t.i} "${t.title}" — ` +
              (t.slack < 0
                ? `overflows by ${-t.slack}px`
                : `only ${t.slack}px to spare`)
          )
          .join('\n') +
        '\n  The page COUNT stays right, so only looking at the PDF reveals this. Scale the ' +
        'type under @media print rather than cutting copy, so the deck is unchanged on screen.'
    );
  }

  await page.pdf({
    path: out,
    preferCSSPageSize: true, // honour the deck's own @page size
    printBackground: true, // without this a dark deck prints as empty pages
  });
  await browser.close();

  const pdf = readFileSync(out);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [])
    .length;

  console.log(
    `  ${slug}.pdf — ${pages} pages, ${(pdf.length / 1048576).toFixed(2)} MB`
  );

  if (pages !== slidesInDom || slidesInDom !== slidesInSource) {
    throw new Error(
      `page/slide mismatch: ${slidesInSource} in source, ${slidesInDom} in DOM, ` +
        `${pages} in PDF.\n  Usually a slide taller than its @page box splitting in two, ` +
        'or content that failed to render. NOT scroll-snap — that is checked separately ' +
        'and does not affect pagination.'
    );
  }
}

const args = process.argv.slice(2);
const slugs = args.includes('--all')
  ? readdirSync(TALKS)
      .filter((f) => f.endsWith('.html'))
      .map((f) => f.replace(/\.html$/, ''))
  : args;

if (slugs.length === 0) {
  console.error('usage: node scripts/render-talk.mjs <slug> | --all');
  process.exit(1);
}

for (const slug of slugs) {
  await render(slug).catch((err) => {
    console.error(`::error::[render-talk] ${slug}: ${err.message}`);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Render public/opengraph-image.png from the project's OWN name.
 *
 * WHY THIS EXISTS. The committed card is 1200x630 of ScriptHammer's lockup — gear
 * ring, printing mallet, "SCRIPTHAMMER.COM" twice around the rim. It is the image
 * Slack, LinkedIn, iMessage and Twitter render when anyone pastes the link, and every
 * fork inherited it. #988 fixed the on-page hero; this is the same borrowed artwork on
 * the surface people see BEFORE they visit.
 *
 * WHAT IT DOES NOT DO: invent a brand. There is no tagline, no illustration and no
 * logo here, because a script cannot know what a project looks like. It draws the two
 * things the project already knows about itself — its name and the initials of that
 * name — on a neutral ground. Derived, never designed, so it is correct for any fork
 * on the day it is created and it cannot ship anyone else's identity.
 *
 * The palette is deliberately neutral rather than theme-matched. Theme colours are
 * authored in `oklch()`, which this renderer does not resolve, and claiming to match a
 * theme it cannot read would be a worse lie than looking plain.
 *
 * Usage: node scripts/generate-og-image.mjs "Project Name" [outfile]
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const WIDTH = 1200;
const HEIGHT = 630;

/** Same derivation as PlaceholderMark: first letter of the first two words. */
export function initialsOf(name) {
  return (
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function cardSvg(name) {
  const initials = initialsOf(name);
  // Escape for XML: a project name is free text a forker supplies.
  const safeName = name.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]
  );
  const nameSize = safeName.length > 22 ? 56 : safeName.length > 14 ? 72 : 88;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e293b"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
  <g fill="none" stroke="#334155" stroke-width="2">
    <path d="M0 210h1200M0 420h1200M400 0v630M800 0v630"/>
  </g>
  <g transform="translate(250 315)">
    <circle r="118" fill="none" stroke="#94a3b8" stroke-width="3" opacity="0.5"/>
    <circle r="98" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.7"/>
    <text text-anchor="middle" dominant-baseline="central" fill="#e2e8f0"
      font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
      font-size="${initials.length > 1 ? 84 : 108}" letter-spacing="3">${initials}</text>
  </g>
  <text x="470" y="315" dominant-baseline="central" fill="#e2e8f0"
    font-family="ui-sans-serif, system-ui, -apple-system, sans-serif"
    font-size="${nameSize}" font-weight="700">${safeName}</text>
</svg>`;
}

export async function generateOgImage(name, outFile) {
  // Imported lazily so the pure functions above stay testable without sharp.
  const sharp = (await import('sharp')).default;
  const png = await sharp(Buffer.from(cardSvg(name), 'utf8'))
    .png()
    .toBuffer();
  writeFileSync(outFile, png);
  return { width: WIDTH, height: HEIGHT, bytes: png.length };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('generate-og-image.mjs');

if (isMain) {
  const name = process.argv[2];
  if (!name) {
    console.error('generate-og-image: a project name is required');
    process.exit(1);
  }
  const out = process.argv[3] || 'public/opengraph-image.png';
  generateOgImage(name, out)
    .then((r) =>
      console.log(
        `  opengraph-image.png  ${r.width}x${r.height}  ${Math.round(r.bytes / 1024)}KB`
      )
    )
    .catch((err) => {
      console.error(`generate-og-image: ${err.message}`);
      process.exit(1);
    });
}

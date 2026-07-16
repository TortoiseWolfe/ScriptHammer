// Server-only manifest read for the twin routes (#292 B1a).
//
// src/app/twins/[slug]/page.tsx and src/app/chatt/page.tsx both need to know,
// at BUILD time, whether a slug's baked manifest.json carries an atlasBox —
// a site with no wide extent is a single-exhibit twin (Build Plan: "Cesium is
// the atlas, Three.js is the exhibit"), so it must always render the diorama,
// regardless of query params. renderer-select.ts's selectRenderer() stays
// pure over URLSearchParams alone; it cannot see the manifest, so this fact
// is threaded in from the page as a separate `hasAtlas` prop (see
// TwinCanvasHost.tsx). fs-based — this file must only ever be imported by
// Server Components.
import fs from 'fs/promises';
import path from 'path';

const TWINS_DIR = () => path.join(process.cwd(), 'public/twins');

/** True iff public/twins/<slug>/manifest.json exists and has an atlasBox.
 *  False on any read/parse failure (unbaked slug, malformed manifest, no
 *  atlasBox) — same "absent means no" fallback the runtime manifest type
 *  documents (`atlasBox?:` — absent on pre-2026-07 bakes). */
export async function siteHasAtlas(slug: string): Promise<boolean> {
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(TWINS_DIR(), slug, 'manifest.json'), 'utf-8')
    ) as { atlasBox?: unknown };
    return manifest.atlasBox != null;
  } catch {
    return false;
  }
}

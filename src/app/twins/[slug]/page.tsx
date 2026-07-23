// Digital-twin viewer route (#232): /twins/<slug> renders any baked site under
// public/twins/. Static export: slugs are enumerated at build time from the
// baked artifacts themselves (a site page exists iff its bake shipped —
// bake-input configs under sites/ are not enough to render).
//
// EXCEPTION (#332): a slug that is declared as another site's `embeddedTwin`
// lives only inside that wider diorama now, so it gets NO standalone page — its
// baked assets stay (the diorama reads its GLB/house.json), but the route is
// suppressed. Promoting a twin to an embed thus auto-retires its standalone URL.
import fs from 'fs/promises';
import path from 'path';
import type { Metadata } from 'next';
import TwinCanvasHost from '@/twin/TwinCanvasHost';
import { siteHasAtlas } from '@/lib/twinManifest.server';

export const dynamicParams = false;

const TWINS_DIR = () => path.join(process.cwd(), 'public/twins');

export async function generateStaticParams() {
  let entries;
  try {
    entries = await fs.readdir(TWINS_DIR(), { withFileTypes: true });
  } catch {
    return [];
  }
  const slugs: string[] = [];
  // Slugs that are some site's embedded twin — filtered out below so they get
  // no standalone route (#332). Collected while we read each manifest anyway.
  const embedded = new Set<string>();
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      // A directory without a manifest (e.g. a stray _raw) is not a site.
      const raw = await fs.readFile(
        path.join(TWINS_DIR(), e.name, 'manifest.json'),
        'utf-8'
      );
      slugs.push(e.name);
      const embed = (
        JSON.parse(raw) as { site?: { embeddedTwin?: { slug?: string } } }
      ).site?.embeddedTwin?.slug;
      if (embed) embedded.add(embed);
    } catch {
      // not a baked site (or unreadable/invalid manifest)
    }
  }
  return slugs.filter((slug) => !embedded.has(slug)).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(TWINS_DIR(), slug, 'manifest.json'), 'utf-8')
    ) as { site?: { name?: string; subtitle?: string } };
    return {
      title: manifest.site?.name ?? slug,
      description: manifest.site?.subtitle,
      alternates: { canonical: `/twins/${slug}/` },
    };
  } catch {
    return { title: slug };
  }
}

export default async function TwinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // A site with no atlasBox (a single as-built house) has nothing for the atlas
  // to add — route it to the diorama regardless of query params (#292 B1a).
  const hasAtlas = await siteHasAtlas(slug);
  return <TwinCanvasHost slug={slug} hasAtlas={hasAtlas} />;
}

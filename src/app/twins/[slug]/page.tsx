// Digital-twin viewer route (#232): /twins/<slug> renders any baked site under
// public/twins/. Static export: slugs are enumerated at build time from the
// baked artifacts themselves (a site page exists iff its bake shipped —
// bake-input configs under sites/ are not enough to render).
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
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      // A directory without a manifest (e.g. a stray _raw) is not a site.
      await fs.access(path.join(TWINS_DIR(), e.name, 'manifest.json'));
      slugs.push(e.name);
    } catch {
      // not a baked site
    }
  }
  return slugs.map((slug) => ({ slug }));
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
  // A site with no atlasBox (e.g. east-main-street-chattanooga, a single
  // as-built house) has nothing for the atlas to add — route it to the
  // diorama regardless of query params (#292 B1a).
  const hasAtlas = await siteHasAtlas(slug);
  return <TwinCanvasHost slug={slug} hasAtlas={hasAtlas} />;
}

// Premium as-built property page (#234): the twin viewer focused on the
// parcel, leading with the LiDAR scan (toggleable against the generated
// massing) plus the property details panel.
//
// Static export: a house page exists ONLY for twins whose baked assets include
// house/house.json — and twin assets are PRIVATE BY DEFAULT (gitignored unless
// allowlisted), so in CI/public builds this route typically emits no pages at
// all. A client-parcel page can therefore exist locally without its address
// ever reaching git or the public site. See #234's privacy gate.
import fs from 'fs/promises';
import path from 'path';
import type { Metadata } from 'next';
import TwinCanvasHost from '@/twin/TwinCanvasHost';

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
      await fs.access(path.join(TWINS_DIR(), e.name, 'house', 'house.json'));
      slugs.push(e.name);
    } catch {
      // twin without an as-built capture — no property page
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
    const house = JSON.parse(
      await fs.readFile(
        path.join(TWINS_DIR(), slug, 'house', 'house.json'),
        'utf-8'
      )
    ) as { label?: string };
    return {
      title: house.label ?? slug,
      alternates: { canonical: `/twins/${slug}/house/` },
    };
  } catch {
    return { title: slug };
  }
}

export default async function HousePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TwinCanvasHost slug={slug} focus="house" />;
}

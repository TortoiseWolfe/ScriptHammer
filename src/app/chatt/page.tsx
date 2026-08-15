// Flagship alias: /chatt is the friendly URL for the Chattanooga twin.
// The canonical viewer route is /twins/chatt (see src/app/twins/[slug]).
import type { Metadata } from 'next';
import TwinCanvasHost from '@/twin/TwinCanvasHost';
import { generateMetadata as buildMetadata } from '@/utils/metadata';
import { siteHasAtlas } from '@/lib/twinManifest.server';

export const metadata: Metadata = {
  ...buildMetadata({
    title: 'Chattanooga in 3D — open-source city atlas',
    description:
      '8,000 buildings at real lidar heights over live OpenStreetMap and USGS 3DEP terrain, in your browser. Open source — join in at Chattanooga.Digital.',
    path: '/chatt/',
    image: '/chatt-diorama-og.jpg',
  }),
  // The helper derives BOTH canonical and og:url from `path` (metadata.tsx:40).
  // og:url should be what people share (/chatt/), but canonical must stay the
  // canonical viewer route — otherwise /chatt/ and /twins/chatt/ become
  // duplicate content, an SEO regression introduced while fixing SEO.
  alternates: { canonical: '/twins/chatt/' },
};

export default async function ChattPage() {
  // Read from the manifest, not hardcoded true: this stays correct even if a
  // future rebake ever drops chatt's atlasBox (#292 B1a) — same fact the
  // canonical /twins/chatt route derives.
  const hasAtlas = await siteHasAtlas('chatt');
  return <TwinCanvasHost slug="chatt" hasAtlas={hasAtlas} />;
}

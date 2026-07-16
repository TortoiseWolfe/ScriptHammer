'use client';
// Client boundary for the twin canvas. In Next.js 15, `dynamic(..., { ssr: false })`
// is only allowed inside a Client Component — so this thin 'use client' wrapper
// owns the ssr:false dynamic imports, and the server pages (/twins/[slug] and the
// /chatt flagship alias) render <TwinCanvasHost slug=.../>. R3F/WebGL needs a
// real browser (no window/WebGL during SSG), and the composer + Rig attach DOM
// listeners that must not run server-side.
//
// TWO RENDERERS, ONE ROUTE (Build Plan: "Cesium is the atlas, Three.js is the
// exhibit ... the data is the bridge, not the engine"). Both read the SAME baked
// artifacts from public/twins/<slug>/; they differ only in what they are good at.
// `?atlas` selects the Cesium view. It is opt-in while the atlas is built out —
// the diorama stays the default until the atlas is at parity, so nothing
// regresses in the meantime.
import dynamic from 'next/dynamic';
import { getAssetUrl } from '@/config/project.config';
import type { TwinFocus } from './TwinCanvas.client';

const TwinCanvas = dynamic(() => import('./TwinCanvas.client'), {
  ssr: false,
});

const AtlasViewer = dynamic(
  async () => {
    // Cesium fetches Workers/, Assets/, ThirdParty/ and Widgets/ at runtime by
    // URL and resolves them against this global, which it reads WHEN THE MODULE
    // EVALUATES. Setting it in the factory body is the ordering guarantee: this
    // runs before the import below is fetched, with no <Script> tag and no
    // beforeInteractive hack.
    //
    // getAssetUrl, never a literal: production basePath is '' (public/CNAME
    // exists, so deploy.yml omits NEXT_PUBLIC_BASE_PATH), but the basepath E2E
    // job and local .env both use '/ScriptHammer'. Only this is right in all
    // four regimes. Trailing slash matters — trailingSlash:true, and a missing
    // one yields '/cesiumWorkers/...'.
    (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL =
      getAssetUrl('/cesium/');
    return import('./cesium/AtlasViewer.client');
  },
  { ssr: false }
);

export default function TwinCanvasHost({
  slug,
  focus,
}: {
  slug: string;
  /** 'house' renders the as-built property page framing (#234). */
  focus?: TwinFocus;
}) {
  // window.location.search, NOT useSearchParams — the same call every other
  // param in this module makes (StageCore's ?nofx, TwinCanvas's ?house/?ortho,
  // useWarehouseEditor's ?edit/?select). useSearchParams forces a Suspense
  // bailout under output:'export'. Safe to read during render here because both
  // branches are dynamic(ssr:false) and therefore render null server-side, so
  // there is no hydration mismatch to create.
  const atlas =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('atlas');
  if (atlas) return <AtlasViewer slug={slug} />;
  return <TwinCanvas slug={slug} focus={focus} />;
}

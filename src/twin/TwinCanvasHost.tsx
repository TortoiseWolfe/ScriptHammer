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
// The atlas is the default (#292) — it is the better view of the city, for any
// slug baked WITH an atlasBox. `?diorama` opts out to the R3F exhibit; the
// diorama's own features (?ortho, ?house, ?edit, ?select, ?nofx) imply it too,
// since they are diorama-only. `?atlas` stays a no-op alias so links shared
// before the flip keep working. A slug baked with no atlasBox (a single
// as-built exhibit) has nothing for the atlas to add and gets the diorama
// regardless of any of the above — see the `hasAtlas` prop below and
// ./renderer-select.ts's selectRendererFor.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { getAssetUrl } from '@/config/project.config';
import { selectRendererFor } from './renderer-select';
import { TwinFooter } from './TwinFooter';
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
  hasAtlas,
}: {
  slug: string;
  /** 'house' renders the as-built property page framing (#234). */
  focus?: TwinFocus;
  /** Whether this slug's baked manifest.json has an atlasBox — determined at
   *  build time by the page (fs read; see src/lib/twinManifest.server.ts),
   *  since selectRendererFor is pure over URLSearchParams and cannot see the
   *  manifest itself. False routes to the diorama unconditionally, even under
   *  ?atlas (#292 B1a) — a site with no wide extent is a single-exhibit twin,
   *  and the atlas has nothing to add to it. */
  hasAtlas: boolean;
}) {
  // window.location.search, NOT useSearchParams — the same call every other
  // param in this module makes (StageCore's ?nofx, TwinCanvas's ?house/?ortho,
  // useWarehouseEditor's ?edit/?select). useSearchParams forces a Suspense
  // bailout under output:'export'. Safe to read during render here because both
  // branches are dynamic(ssr:false) and therefore render null server-side, so
  // there is no hydration mismatch to create.
  const params =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  // focus='house' is the as-built property framing (#234) — diorama-only, and it
  // arrives as a prop rather than a param.
  const isDiorama =
    focus === 'house' || selectRendererFor(params, hasAtlas) === 'diorama';

  // Route-scoped chrome, owned HERE rather than in either renderer (#301).
  // It used to live in TwinCanvas.client (the diorama), so when #292 made the
  // atlas the default, /chatt -- the most-shared route -- silently got NO
  // chrome suppression at all, which is why the PWA-install button collides
  // with the atlas's target card. The host is the only place that knows the
  // route is a twin route BEFORE knowing which renderer won.
  //
  // TWO classes because the renderers genuinely want different things:
  //   twin-fullscreen  both -- the scene is the page; hides the PWA popup.
  //   twin-diorama     diorama only -- also hides the cookie banner, because
  //                    the diorama's dock sits at bottom:16 and the ~66px
  //                    banner buries it. The ATLAS keeps its banner: /chatt is
  //                    the link we promote, and someone landing there must
  //                    still be able to consent (owner's call). The banner
  //                    covers the atlas's footer strip until dismissed --
  //                    accepted, and it is dismissible.
  //
  // Effect, not render: this mutates document.body, and it must not run during
  // SSG. The host is NOT ssr:false (only its two dynamic imports are), so it
  // renders server-side, where useEffect does not run. Cleanup on unmount
  // keeps every other route unaffected; StrictMode's add->remove->add nets to
  // added, and the host renders exactly one renderer, never both.
  useEffect(() => {
    const body = document.body;
    body.classList.add('twin-fullscreen');
    if (isDiorama) body.classList.add('twin-diorama');
    return () => {
      body.classList.remove('twin-fullscreen');
      body.classList.remove('twin-diorama');
    };
  }, [isDiorama]);

  // TwinFooter renders for both renderers and is NOT ssr:false, so it lands in
  // the static HTML; globals.css keeps it display:none until the body class is
  // set, so hydration flips the chrome in one step rather than showing the site
  // footer and the strip at once.
  return (
    <>
      {isDiorama ? (
        <TwinCanvas slug={slug} focus={focus} />
      ) : (
        <AtlasViewer slug={slug} />
      )}
      <TwinFooter />
    </>
  );
}

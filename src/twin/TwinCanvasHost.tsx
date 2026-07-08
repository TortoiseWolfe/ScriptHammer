'use client';
// Client boundary for the R3F canvas. In Next.js 15, `dynamic(..., { ssr: false })`
// is only allowed inside a Client Component — so this thin 'use client' wrapper
// owns the ssr:false dynamic import, and the server pages (/twins/[slug] and the
// /chatt flagship alias) render <TwinCanvasHost slug=.../>. R3F/WebGL needs a
// real browser (no window/WebGL during SSG), and the composer + Rig attach DOM
// listeners that must not run server-side.
import dynamic from 'next/dynamic';

const TwinCanvas = dynamic(() => import('./TwinCanvas.client'), {
  ssr: false,
});

export default function TwinCanvasHost({ slug }: { slug: string }) {
  return <TwinCanvas slug={slug} />;
}

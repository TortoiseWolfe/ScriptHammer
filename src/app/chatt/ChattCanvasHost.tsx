'use client';
// Client boundary for the R3F canvas. In Next.js 15, `dynamic(..., { ssr: false })`
// is only allowed inside a Client Component — so this thin 'use client' wrapper
// owns the ssr:false dynamic import, and the server page renders <ChattCanvasHost/>.
// R3F/WebGL needs a real browser (no window/WebGL during SSG), and the composer +
// Rig attach DOM listeners that must not run server-side.
import dynamic from 'next/dynamic';

const ChattCanvas = dynamic(() => import('./ChattCanvas.client'), {
  ssr: false,
});

export default function ChattCanvasHost() {
  return <ChattCanvas />;
}

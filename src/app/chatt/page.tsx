// Chattanooga Mini — tilt-shift diorama route.
// The <Canvas> host is dynamically imported ssr:false: R3F/WebGL needs a
// real browser (no window/WebGL context during SSG), and the composer +
// Rig attach DOM listeners that must not run server-side.
import dynamic from 'next/dynamic';

const ChattCanvas = dynamic(() => import('./ChattCanvas.client'), {
  ssr: false,
});

export default function ChattPage() {
  return <ChattCanvas />;
}

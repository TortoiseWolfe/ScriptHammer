// Chattanooga Mini — tilt-shift diorama route (server component).
// The ssr:false dynamic import lives in the ChattCanvasHost CLIENT component
// (Next.js 15 disallows ssr:false dynamic in Server Components).
import ChattCanvasHost from './ChattCanvasHost';

export default function ChattPage() {
  return <ChattCanvasHost />;
}

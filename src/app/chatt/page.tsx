// Flagship alias: /chatt is the friendly URL for the Chattanooga Mini twin.
// The canonical viewer route is /twins/chatt (see src/app/twins/[slug]).
import type { Metadata } from 'next';
import TwinCanvasHost from '@/twin/TwinCanvasHost';

export const metadata: Metadata = {
  title: 'Chattanooga Mini',
  description: 'a living tilt-shift diorama',
  alternates: { canonical: '/twins/chatt/' },
};

export default function ChattPage() {
  return <TwinCanvasHost slug="chatt" />;
}

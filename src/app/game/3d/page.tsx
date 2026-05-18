'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import Loader from '@/components/game/Loader';

// Dynamically import Three.js Scene to:
//   - Code-split the ~600 KB Three.js + R3F + drei bundle to this route only
//     (per NFR-001 and research.md Decision 5)
//   - Avoid SSR (R3F is client-only; per NFR-005)
const Scene = dynamic(() => import('@/components/game/Scene'), {
  loading: () => <Loader />,
  ssr: false,
});

export default function ThreeDGamePage() {
  return (
    <main className="from-base-200 via-base-100 to-base-200 bg-gradient-to-br py-6">
      <div className="container mx-auto px-4">
        {/* Heading + breadcrumb */}
        <div className="mb-4">
          <h1 className="mb-1 text-2xl font-bold">3D Game (Three.js)</h1>
          <nav aria-label="Breadcrumb" className="text-base-content/85 text-sm">
            <Link href="/game" className="text-primary underline">
              /game
            </Link>
            <span aria-hidden="true"> / 3d</span>
          </nav>
        </div>

        {/* Three.js scene */}
        <div className="mx-auto max-w-7xl">
          <Scene />
        </div>
      </div>
    </main>
  );
}

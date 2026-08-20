'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import Loader from '@/components/game/Loader';

// Dynamically import the R3F walking skeleton to:
//   - Code-split the Three.js + R3F bundle to this route only
//   - Avoid SSR (R3F + the vendored physics are client-only)
const CodSkeleton = dynamic(() => import('@/components/game/CodSkeleton'), {
  loading: () => <Loader />,
  ssr: false,
});

export default function CodSkeletonPage() {
  return (
    <main className="from-base-200 via-base-100 to-base-200 bg-gradient-to-br py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <h1 className="mb-1 text-2xl font-bold">
            CoD Walking Skeleton (physics spike)
          </h1>
          <nav aria-label="Breadcrumb" className="text-base-content text-sm">
            <Link href="/game" className="text-primary underline">
              /game
            </Link>
            <span aria-hidden="true"> / cod-skeleton</span>
          </nav>
          <p className="text-base-content mt-2 max-w-2xl text-sm">
            First-person capsule controller harvested from the MIT{' '}
            <a
              href="https://github.com/mshumer/Claude-of-Duty"
              className="text-primary underline"
              target="_blank"
              rel="noreferrer noopener"
            >
              Claude-of-Duty
            </a>{' '}
            physics core, driven inside React Three Fiber. Click to capture the
            mouse, then WASD to move and Space to jump. Walk up the step, into
            the wall, and around the crate.
          </p>
        </div>

        <div className="mx-auto max-w-7xl">
          <CodSkeleton />
        </div>
      </div>
    </main>
  );
}

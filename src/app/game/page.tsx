'use client';

import dynamic from 'next/dynamic';

// Dynamically import game component to reduce initial bundle size
const CaptainShipCrewWithNPC = dynamic(
  () =>
    import('@/components/atomic/CaptainShipCrewWithNPC/CaptainShipCrewWithNPC'),
  {
    loading: () => (
      <div className="bg-base-200 card flex h-96 items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4 text-sm">Loading game...</p>
      </div>
    ),
    ssr: false,
  }
);

export default function GamePage() {
  return (
    <main className="from-base-200 via-base-100 to-base-200 bg-gradient-to-br py-6">
      <div className="container mx-auto px-4">
        {/* Compact Header */}
        <div className="mb-4 text-center">
          <h1 className="mb-2 text-3xl font-bold">Captain, Ship & Crew</h1>
          <p className="text-base-content/70 text-sm">
            Roll for your ship, captain, and crew!
          </p>
        </div>

        {/* Main Game Area - Two column on large screens */}
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            {/* Game Component - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <CaptainShipCrewWithNPC />
            </div>

            {/* Instructions - Side panel on large screens */}
            <div className="lg:col-span-1">
              <div className="card bg-base-200/50 sticky top-4 h-fit">
                <div className="card-body p-4">
                  <h2 className="card-title mb-3 text-base">How to Play</h2>
                  <ul className="space-y-2 text-xs">
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">1.</span>
                      <span>
                        Roll five dice to get a Ship (6), Captain (5), and Crew
                        (4) in that order
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">2.</span>
                      <span>
                        Once you have all three, the remaining two dice are your
                        cargo score
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">3.</span>
                      <span>
                        You have three rolls per turn to maximize your score
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">4.</span>
                      <span>Beat the NPC to win!</span>
                    </li>
                  </ul>

                  <div className="divider my-3"></div>

                  <div className="space-y-1 text-xs opacity-70">
                    <p>
                      <strong>Tip:</strong> Higher cargo scores win rounds
                    </p>
                    <p>
                      <strong>Strategy:</strong> Decide when to keep or reroll
                      cargo dice
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

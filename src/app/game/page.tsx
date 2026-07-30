'use client';

import dynamic from 'next/dynamic';

// Dynamically import game component to reduce initial bundle size
const CaptainShipCrewWithNPC = dynamic(
  () =>
    import(
      '@/components/organisms/CaptainShipCrewWithNPC/CaptainShipCrewWithNPC'
    ),
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
    // Flat frame, not the three-stop gradient — the same shape /docs and
    // /status use, with an explicit measure instead of `container`.
    //
    // The explicit measure is a readability choice, not a bug fix: this comment
    // used to claim `container` clamps to the previous breakpoint, which #373's
    // §A1 had already corrected before it was written (#463).
    <main className="bg-base-200 min-h-full py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-base-content mb-2 font-mono text-xs tracking-[.14em] uppercase">
            Playable demo
          </p>
          {/* The TEXT is pinned: tests/e2e/pages/HomePage.ts:27 selects
              `h1:has-text("Captain, Ship & Crew")`. Restyled, never retitled. */}
          <h1 className="text-base-content font-display text-4xl tracking-[-0.025em] sm:text-5xl">
            Captain, Ship & Crew
          </h1>
          {/* Solid, not `/85` — opacity-suffixed text fails the AAA gate
              (#411, #425) and /game is in the sweep. */}
          <p className="text-base-content mt-2 text-sm">
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
              {/* A cut WELL, padded. `bg-base-200/50` was invisible against a
                  base-200 page — a 50% tint of the surface it sits on. The
                  padding is load-bearing: `sh-well` is an inset shadow painted
                  below child content, so a flush child would hide it. */}
              <div className="sh-well bg-base-100 rounded-box sticky top-4 h-fit p-5">
                <h2 className="text-base-content mb-3 font-mono text-xs tracking-[.14em] uppercase">
                  How to Play
                </h2>
                {/* A real ordered list. The numbers were hand-typed into spans
                    styled `text-primary`, which meant a screen reader heard
                    "1." as content and the sequence carried no semantics. */}
                <ol className="text-base-content list-decimal space-y-2 pl-5 text-xs">
                  <li>
                    Roll five dice to get a Ship (6), Captain (5), and Crew (4)
                    in that order
                  </li>
                  <li>
                    Once you have all three, the remaining two dice are your
                    cargo score
                  </li>
                  <li>You have three rolls per turn to maximize your score</li>
                  <li>Beat the NPC to win!</li>
                </ol>

                <div className="divider my-3"></div>

                {/* Solid, not `/85` (#411, #425). */}
                <div className="text-base-content space-y-1 text-xs">
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
    </main>
  );
}

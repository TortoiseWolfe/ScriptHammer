'use client';

import dynamic from 'next/dynamic';
import Icon from '@/components/atomic/Icon';

const CalendarEmbed = dynamic(
  () => import('@/components/atomic/CalendarEmbed'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    ),
  }
);

export default function SchedulePage() {
  return (
    // One explicit measure instead of `container` plus an inner `max-w-7xl`.
    //
    // The old comment here said the inner measure "never got a chance to apply"
    // because `container` clamped — untrue: `container` is 1280px at every tier
    // since #373's §A1, so the two were simply redundant (#463).
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div>
        {/* Two-column layout on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Left column - Text content */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-8">
              <header>
                <p className="text-base-content mb-2 font-mono text-xs tracking-[.14em] uppercase">
                  Book a call
                </p>
                <h1 className="text-base-content font-display mb-4 text-4xl tracking-[-0.025em] sm:text-5xl">
                  Schedule a Meeting
                </h1>
                {/* `prose` is inert in this app (#373) — it was wrapping this
                    paragraph and doing nothing. */}
                <p className="text-base-content mb-6">
                  Book a time that works for you. We&apos;ll send a calendar
                  invitation with all the details.
                </p>
              </header>

              {/* Four loose siblings became one recessed LEDGER with divided
                  rows — the /docs + /status idiom: depth on the padded
                  container, rows stay flat. `px-5` is load-bearing: sh-well is
                  an inset shadow painted below child content, so a flush child
                  would hide it. The tip keeps its own raised plate, which is
                  the 2a plate-in-well vocabulary and marks it as the one
                  actionable panel here. */}
              <div className="sh-well bg-base-100 rounded-box divide-base-300 divide-y px-5">
                <div className="py-4">
                  <h2 className="text-base-content mb-2 font-mono text-xs tracking-[.14em] uppercase">
                    What to expect:
                  </h2>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>15-minute quick sync</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Discussion of your project requirements</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Q&A and next steps</span>
                    </li>
                  </ul>
                </div>

                <div className="sh-plate bg-base-100 rounded-box my-4 p-5">
                  <h2 className="mb-2 flex items-center text-lg font-semibold">
                    {/* Decorative (#385): "Prepare for the meeting:" follows. */}
                    <span className="mr-2">
                      <Icon name="tip" decorative />
                    </span>
                    Prepare for the meeting:
                  </h2>
                  <p className="mb-3 text-sm">
                    In the meeting notes section, please include:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>
                        <strong>Your GitHub repository link</strong> - This
                        helps us review your code beforehand
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Brief project description</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>
                        Specific questions or challenges you&apos;re facing
                      </span>
                    </li>
                  </ul>
                  <p className="text-base-content mt-3 text-xs">
                    This information helps us make the most of our time
                    together.
                  </p>
                </div>

                <div className="py-4">
                  <h2 className="text-base-content mb-2 font-mono text-xs tracking-[.14em] uppercase">
                    Time zones:
                  </h2>
                  <p className="text-base-content text-sm">
                    All times are shown in your local timezone. The calendar
                    will automatically adjust for daylight saving time.
                  </p>
                </div>

                <div className="py-4">
                  <h2 className="text-base-content mb-2 font-mono text-xs tracking-[.14em] uppercase">
                    Need to reschedule?
                  </h2>
                  <p className="text-base-content text-sm">
                    You can reschedule or cancel your appointment using the link
                    in your confirmation email.
                  </p>
                </div>
              </div>

              <footer className="text-base-content mt-8 space-y-2 text-xs">
                <p>Powered by scheduling integration</p>
                <p>
                  <a
                    href="https://github.com/TortoiseWolfe/ScriptHammer/tree/main/src/components/atomic/CalendarEmbed"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                  >
                    View component source →
                  </a>
                </p>
              </footer>
            </div>
          </aside>

          {/* Right column - Calendar embed */}
          <section className="lg:col-span-2">
            <div className="sh-well bg-base-100 rounded-box min-h-[1200px] p-4 lg:min-h-[1250px] lg:p-6">
              <CalendarEmbed mode="inline" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

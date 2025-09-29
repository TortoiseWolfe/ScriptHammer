'use client';

import dynamic from 'next/dynamic';

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
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Two-column layout on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Left column - Text content */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-8">
              <header>
                <h1 className="mb-4 text-3xl font-bold lg:text-4xl">
                  Schedule a Meeting
                </h1>
                <div className="prose prose-sm lg:prose-base mb-6">
                  <p>
                    Book a time that works for you. We&apos;ll send a calendar
                    invitation with all the details.
                  </p>
                </div>
              </header>

              {/* Additional helpful information */}
              <div className="space-y-6">
                <div>
                  <h2 className="mb-2 text-lg font-semibold">
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

                <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
                  <h2 className="mb-2 flex items-center text-lg font-semibold">
                    <span className="mr-2">💡</span>
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
                  <p className="text-base-content/70 mt-3 text-xs">
                    This information helps us make the most of our time
                    together.
                  </p>
                </div>

                <div>
                  <h2 className="mb-2 text-lg font-semibold">Time zones:</h2>
                  <p className="text-base-content/70 text-sm">
                    All times are shown in your local timezone. The calendar
                    will automatically adjust for daylight saving time.
                  </p>
                </div>

                <div>
                  <h2 className="mb-2 text-lg font-semibold">
                    Need to reschedule?
                  </h2>
                  <p className="text-base-content/70 text-sm">
                    You can reschedule or cancel your appointment using the link
                    in your confirmation email.
                  </p>
                </div>
              </div>

              <footer className="mt-8 space-y-2 text-xs opacity-60">
                <p>Powered by scheduling integration</p>
                <p>
                  <a
                    href="/storybook/?path=/story/atomic-calendarembed--default"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                  >
                    View component in Storybook →
                  </a>
                </p>
              </footer>
            </div>
          </aside>

          {/* Right column - Calendar embed */}
          <section className="lg:col-span-2">
            <div className="bg-base-200/50 min-h-[1200px] rounded-lg p-4 lg:min-h-[1250px] lg:p-6">
              <CalendarEmbed mode="inline" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

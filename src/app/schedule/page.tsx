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
      <article className="mx-auto max-w-4xl">
        <header>
          <h1 className="mb-6 text-4xl font-bold">Schedule a Meeting</h1>
          <div className="prose mb-8">
            <p>
              Book a time that works for you. We&apos;ll send a calendar
              invitation with all the details.
            </p>
          </div>
        </header>

        <section>
          <CalendarEmbed mode="inline" />
        </section>

        <footer className="mt-8 text-center text-sm opacity-60">
          <p>Powered by scheduling integration</p>
        </footer>
      </article>
    </main>
  );
}

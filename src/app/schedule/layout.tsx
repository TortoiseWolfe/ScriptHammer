import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Schedule a Meeting',
  description:
    "Book a time that works for you. We'll send a calendar invitation with all the details.",
};

export default function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

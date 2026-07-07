import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Status - ScriptHammer',
  description:
    'View comprehensive project status including PWA capabilities, Lighthouse scores, web vitals, deployment history, and task progress tracking.',
};

export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

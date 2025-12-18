import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email - ScriptHammer',
  description: 'Verify your email address for ScriptHammer',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

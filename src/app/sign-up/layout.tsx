import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - ScriptHammer',
  description: 'Create a new ScriptHammer account',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

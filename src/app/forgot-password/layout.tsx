import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password - ScriptHammer',
  description: 'Reset your ScriptHammer account password',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

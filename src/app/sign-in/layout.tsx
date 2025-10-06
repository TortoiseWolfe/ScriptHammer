import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - ScriptHammer',
  description: 'Sign in to your ScriptHammer account',
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

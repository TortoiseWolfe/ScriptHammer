import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payment Demo - ScriptHammer',
  description: 'Payment integration demonstration',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PaymentDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

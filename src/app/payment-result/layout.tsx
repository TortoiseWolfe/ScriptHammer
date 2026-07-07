import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payment Result - ScriptHammer',
  description: 'Payment outcome and receipt',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PaymentResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

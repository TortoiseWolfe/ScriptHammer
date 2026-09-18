import type { Metadata } from 'next';
import Link from 'next/link';
import TipJar from '@/components/payment/TipJar';
import { routeMetadata } from '@/utils/metadata';

export const metadata: Metadata = {
  ...routeMetadata('/tip/'),
  title: 'Tip Jar - ScriptHammer',
  description:
    'The template is free and stays free. This is only if you want to.',
};

/**
 * /tip (T051). Supersedes the never-built `/donate` -- the archived specs at
 * docs/specs/015-payment-integration/quickstart.md still describe a `/donate`
 * route and a `DonateButton`, and neither was ever implemented. This is the one
 * that ships; do not build both.
 *
 * It exists because the open-source lane has nothing to buy. Forge is free, and
 * the only other way to give this project money is a $250+ service package that
 * requires creating and confirming an account first.
 */
export default function TipPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-3 text-3xl font-bold">Tip jar</h1>
      <p className="text-base-content/80 mb-2">
        The template is free and stays free. Nothing here is gated, nothing
        unlocks, and nothing changes if you skip this page.
      </p>
      <p className="text-base-content/80 mb-8">
        If it saved you a weekend, this is where you can say so.
      </p>

      <TipJar className="mb-8" />

      <div className="border-base-300 border-t pt-6 text-sm">
        <p className="text-base-content/70 mb-2">
          One-time, any amount between $1 and $500, whole dollars. Card payment
          goes through the same checkout as everything else, so it needs an
          account — that is how the receipt reaches you.
        </p>
        <p className="text-base-content/70">
          Voluntary contributions are not refundable. See the{' '}
          <Link href="/terms" className="link">
            terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

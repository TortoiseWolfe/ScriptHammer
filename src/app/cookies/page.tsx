import React from 'react';
import { Metadata } from 'next';
import { CookieActions } from '@/components/privacy/CookieActions';

export const metadata: Metadata = {
  title: 'Cookie Policy - ScriptHammer',
  description:
    'Learn how ScriptHammer uses cookies and how you can manage your cookie preferences.',
};

export default function CookiePolicyPage() {
  const lastUpdated = '2025-09-15';

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Cookie Policy
        </h1>
      </header>

      {/* Quick Actions - Client Component */}
      <CookieActions />

      <article className="prose prose-lg max-w-none">
        <p className="text-base-content/70 mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            Updates to This Policy
          </h2>
          <p className="mb-4">
            We may update this Cookie Policy from time to time to reflect
            changes in our practices or for other operational, legal, or
            regulatory reasons. We will notify you of any material changes by
            updating the &ldquo;Last updated&rdquo; date at the top of this
            policy.
          </p>
        </section>
      </article>
    </main>
  );
}

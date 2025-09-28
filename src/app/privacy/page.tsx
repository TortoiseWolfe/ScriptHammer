import React from 'react';
import { Metadata } from 'next';
import { PrivacyActions } from '@/components/privacy/PrivacyActions';

export const metadata: Metadata = {
  title: 'Privacy Policy - ScriptHammer',
  description:
    'Learn how ScriptHammer protects your privacy and handles your personal information.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = '2025-09-15';

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Privacy Policy
        </h1>
      </header>

      {/* Quick Actions - Client Component */}
      <PrivacyActions />

      <article className="prose prose-lg max-w-none">
        <p className="text-base-content/70 mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">1. Introduction</h2>
          <p className="mb-4">
            Welcome to ScriptHammer. We are committed to protecting your privacy
            and ensuring you have a positive experience on our website. This
            privacy policy explains how we collect, use, and protect your
            personal information in compliance with the General Data Protection
            Regulation (GDPR) and other applicable privacy laws.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            10. Children&apos;s Privacy
          </h2>
          <p className="mb-4">
            Our website is not intended for children under 16 years of age. We
            do not knowingly collect personal data from children. If you believe
            we have collected data from a child, please contact us immediately.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            11. Changes to This Policy
          </h2>
          <p className="mb-4">
            We may update this privacy policy from time to time. We will notify
            you of any changes by posting the new policy on this page and
            updating the &ldquo;Last updated&rdquo; date. For significant
            changes, we may request renewed consent.
          </p>
        </section>
      </article>
    </main>
  );
}

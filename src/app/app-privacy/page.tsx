import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { routeMetadata } from '@/utils/metadata';

export const metadata: Metadata = {
  // This route claims its own URL and keeps the social card (#668, #990).
  ...routeMetadata('/app-privacy/'),
  title: 'iOS App Privacy - ScriptHammer',
  description:
    'What the ScriptHammer iOS reading app collects: nothing. No account, no network, no permissions, no analytics.',
};

/**
 * The privacy policy for the ScriptHammer iOS app, which is a different product
 * from this website and has different — much shorter — data practices.
 *
 * WHY THIS PAGE EXISTS RATHER THAN A LINE ON /privacy/.
 *
 * App Store Connect requires a Privacy Policy URL, and Apple's Guideline
 * 5.1.1(i) asks for one describing THAT app. `/privacy/` describes this website:
 * accounts, sign-in events, IP addresses, browser user-agents, cookie consent.
 * None of it happens in the app. Pointing Apple at it would claim data practices
 * the app does not have — erring toward over-statement, which is the safer
 * direction legally and still not what the guideline asks for.
 *
 * Everything below is the same set of claims the app makes on its own About
 * screen, and those are enforced in the app's test suite (`src/claims.test.ts`
 * in TortoiseWolfe/ScriptHammer-Expo): it reads every runtime source file and
 * fails on `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, any networking
 * or analytics import, and any sign-in symbol. If this page ever stops being
 * true, that suite goes red first.
 */
export default function AppPrivacyPage() {
  const lastUpdated = '2026-09-06';

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-2 !text-2xl font-bold sm:!text-4xl md:!text-5xl">
          iOS App Privacy
        </h1>
        <p className="text-base-content mb-6 text-sm sm:mb-8">
          For <strong>ScriptHammer</strong>, the reading app for iPhone and
          iPad. The website has its own{' '}
          <Link href="/privacy/" className="link link-primary">
            privacy policy
          </Link>
          , which is different.
        </p>
      </header>

      <article className="sh-doc">
        <p className="text-base-content mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>

        <section className="mb-8">
          <h2>What the app collects</h2>
          <p>
            <strong>Nothing.</strong> The app has no account system, makes no
            network requests, and asks for no permissions. There is no server to
            send anything to and no code that could send it.
          </p>
          <ul>
            <li>
              <strong>No account.</strong> There is nowhere to sign in. No name,
              email address, or password is ever requested.
            </li>
            <li>
              <strong>No network.</strong> All fourteen articles are inside the
              download. The app makes no requests of any kind. Tapping a link in
              an article hands the address to your browser; the app never sees
              what comes back.
            </li>
            <li>
              <strong>No permissions.</strong> It never asks for location,
              camera, microphone, contacts, photos, notifications or anything
              else, because it uses none of them.
            </li>
            <li>
              <strong>No analytics, crash reporting, or identifiers.</strong> No
              advertising identifier, no device fingerprint, no usage telemetry.
            </li>
          </ul>
          <p>
            This is also why the app works on a plane, in a basement, and on
            first launch before any network exists.
          </p>
        </section>

        <section className="mb-8">
          <h2>What is stored on your device</h2>
          <p>
            Your reading preferences — text size, line spacing, font, contrast,
            motion and the chosen theme — are saved locally so the app opens the
            way you left it. They stay on the device, are never transmitted, and
            are removed when you delete the app.
          </p>
        </section>

        <section className="mb-8">
          <h2>Third parties</h2>
          <p>
            None. The app contains no third-party SDKs for analytics,
            advertising, attribution or crash reporting. No data is shared with
            anyone, because none is collected.
          </p>
          <p>
            Apple may collect its own information when you download the app or
            use TestFlight, under Apple&apos;s privacy policy rather than this
            one. We receive only the anonymous, aggregated sales and crash
            reporting that App Store Connect shows every developer, and it
            identifies no one.
          </p>
        </section>

        <section className="mb-8">
          <h2>Children</h2>
          <p>
            The app collects no personal data from anyone, including children.
            It has no accounts, no messaging, no user-generated content and no
            open web browsing.
          </p>
        </section>

        <section className="mb-8">
          <h2>Changes to this policy</h2>
          <p>
            If the app ever begins collecting anything, this page will say so
            before that version ships, and the &ldquo;Last updated&rdquo; date
            will change. A policy revised after the fact is not a policy.
          </p>
        </section>

        <section className="mb-8">
          <h2>Contact</h2>
          <p>
            Questions about this policy can go through the{' '}
            <Link href="/contact/" className="link link-primary">
              contact page
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}

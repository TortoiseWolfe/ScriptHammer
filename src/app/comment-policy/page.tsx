import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Comment Policy - ScriptHammer',
  description:
    'Our comment policy promotes constructive dialogue. We welcome diverse opinions expressed respectfully.',
};

export default function CommentPolicyPage() {
  const lastUpdated = '2025-01-27';

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Comment Policy
        </h1>
      </header>

      <article className="prose prose-lg max-w-none">
        <p className="text-base-content/70 mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            Welcome to Our Community
          </h2>
          <p className="mb-4">
            We encourage thoughtful discussion and welcome your comments on our
            blog posts. This comment policy outlines our expectations for
            participation and helps maintain a respectful, constructive
            environment for all readers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            What We Encourage
          </h2>
          <ul className="mb-4 list-disc pl-6">
            <li>Constructive feedback and respectful disagreement</li>
            <li>Relevant questions and thoughtful insights</li>
            <li>Sharing helpful resources and experiences</li>
            <li>Supporting other community members</li>
            <li>Staying on topic and adding value to the discussion</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            What&apos;s Not Allowed
          </h2>
          <p className="mb-4">
            The following types of content will be removed and may result in a
            ban:
          </p>
          <ul className="mb-4 list-disc pl-6">
            <li>
              <strong>Spam</strong>: Promotional content, excessive links, or
              repetitive posts
            </li>
            <li>
              <strong>Hate Speech</strong>: Content that attacks people based on
              race, ethnicity, national origin, religion, gender, sexual
              orientation, disability, or disease
            </li>
            <li>
              <strong>Harassment</strong>: Personal attacks, threats, doxxing,
              or bullying
            </li>
            <li>
              <strong>Profanity</strong>: Excessive or gratuitous use of
              offensive language
            </li>
            <li>
              <strong>Off-Topic</strong>: Comments unrelated to the post content
            </li>
            <li>
              <strong>Misinformation</strong>: Deliberately false or misleading
              information
            </li>
            <li>
              <strong>Copyright Violations</strong>: Content that infringes on
              intellectual property rights
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            Moderation Process
          </h2>
          <p className="mb-4">All comments are subject to moderation:</p>
          <ul className="mb-4 list-disc pl-6">
            <li>
              First-time commenters may experience a delay while their comment
              is reviewed
            </li>
            <li>
              Comments containing links are held for review to prevent spam
            </li>
            <li>
              We reserve the right to edit or delete comments that violate this
              policy
            </li>
            <li>Repeat violations will result in permanent banning</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            User Accounts
          </h2>
          <p className="mb-4">
            Comments are managed through Disqus. To comment, you&apos;ll need:
          </p>
          <ul className="mb-4 list-disc pl-6">
            <li>A Disqus account (free to create)</li>
            <li>A recognizable username (not offensive or misleading)</li>
            <li>To agree to Disqus&apos;s Terms of Service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            Privacy & Data
          </h2>
          <p className="mb-4">When you comment:</p>
          <ul className="mb-4 list-disc pl-6">
            <li>Your comment and username are publicly visible</li>
            <li>Your email address is not displayed publicly</li>
            <li>Disqus may collect data according to their privacy policy</li>
            <li>We don&apos;t sell or share your personal information</li>
          </ul>
          <p className="mb-4">
            For more details, see our{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            Enforcement
          </h2>
          <p className="mb-4">Violations are handled as follows:</p>
          <ol className="mb-4 list-decimal pl-6">
            <li>
              <strong>First Offense</strong>: Warning and comment removal if
              necessary
            </li>
            <li>
              <strong>Second Offense</strong>: Temporary suspension (7 days)
            </li>
            <li>
              <strong>Third Offense</strong>: Permanent ban
            </li>
          </ol>
          <p className="mb-4">
            Severe violations (hate speech, threats, doxxing) result in
            immediate permanent bans.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            Appeals & Contact
          </h2>
          <p className="mb-4">
            If you believe your comment was removed in error or wish to appeal a
            moderation decision, please{' '}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>{' '}
            with:
          </p>
          <ul className="mb-4 list-disc pl-6">
            <li>Your Disqus username</li>
            <li>The post where the comment was made</li>
            <li>Approximate date and time</li>
            <li>Reason for appeal</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">
            Policy Updates
          </h2>
          <p className="mb-4">
            We may update this policy periodically. Continued commenting after
            changes indicates acceptance of the updated policy. Major changes
            will be announced on the blog.
          </p>
        </section>

        <section className="bg-base-200 mb-8 rounded-lg p-6">
          <h2 className="mb-4 text-xl font-semibold">Quick Summary</h2>
          <p className="text-base-content/80">
            Be respectful, stay on topic, and contribute meaningfully. No spam,
            harassment, or offensive content. We moderate comments to maintain
            quality discussions. Violations may result in removal or bans.
          </p>
        </section>
      </article>
    </main>
  );
}

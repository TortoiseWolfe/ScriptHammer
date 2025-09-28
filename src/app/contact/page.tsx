import type { Metadata } from 'next';
import { ContactForm } from '@/components/forms/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us | ScriptHammer',
  description:
    "Get in touch with the ScriptHammer team. We'd love to hear from you!",
  keywords: ['contact', 'support', 'help', 'feedback', 'ScriptHammer'],
  openGraph: {
    title: 'Contact Us | ScriptHammer',
    description: 'Get in touch with the ScriptHammer team',
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <main className="container mx-auto min-h-screen px-4 py-6 sm:py-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="mb-4 !text-2xl font-bold sm:!text-4xl md:!text-5xl">
            Get in Touch
          </h1>
          <p className="text-base-content/70 text-base sm:text-lg md:text-xl">
            Have a question, suggestion, or just want to say hello? We&apos;d
            love to hear from you!
          </p>
        </div>

        <div className="divider"></div>

        <div className="mb-8 grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
                Why Contact Us?
              </h2>
              <ul className="text-base-content/80 space-y-2">
                <li className="flex items-start">
                  <svg
                    className="text-primary mt-1 mr-2 h-5 w-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Report bugs or issues
                </li>
                <li className="flex items-start">
                  <svg
                    className="text-primary mt-1 mr-2 h-5 w-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Request new features
                </li>
                <li className="flex items-start">
                  <svg
                    className="text-primary mt-1 mr-2 h-5 w-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Get help with implementation
                </li>
                <li className="flex items-start">
                  <svg
                    className="text-primary mt-1 mr-2 h-5 w-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Share your feedback
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold sm:text-xl">
                Response Time
              </h3>
              <p className="text-base-content/80 text-sm sm:text-base">
                We typically respond within 24-48 hours during business days.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold sm:text-xl">
                Other Ways to Connect
              </h3>
              <div className="space-y-2">
                <a
                  href="https://github.com/TortoiseWolfe/ScriptHammer/issues"
                  className="link link-primary flex items-center"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub Issues
                </a>
                <a
                  href="https://github.com/TortoiseWolfe/ScriptHammer/discussions"
                  className="link link-primary flex items-center"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GitHub Discussions
                </a>
              </div>
            </div>
          </div>

          <div className="card bg-base-200">
            <div className="card-body">
              <ContactForm />
            </div>
          </div>
        </div>

        <div className="text-base-content/60 text-center text-xs sm:text-sm">
          <p>
            Your privacy is important to us. We&apos;ll never share your
            information with third parties.
          </p>
        </div>
      </div>
    </main>
  );
}

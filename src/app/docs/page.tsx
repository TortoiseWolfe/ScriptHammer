import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation - ScriptHammer',
  description:
    'Comprehensive documentation for ScriptHammer - Modern Next.js template with PWA, testing, and more.',
};

export default function DocsPage() {
  const docSections = [
    {
      title: 'Getting Started',
      description: 'Quick setup and installation guide',
      links: [
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/README.md',
          label: 'README',
          external: true,
        },
        {
          href: '/blog/scripthammer-intro',
          label: 'Introduction to ScriptHammer',
          external: false,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer#quick-start',
          label: 'Quick Start',
          external: true,
        },
      ],
    },
    {
      title: 'Developer Guide',
      description: 'Comprehensive development documentation',
      links: [
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/CLAUDE.md',
          label: 'CLAUDE.md - AI Development Guide',
          external: true,
        },
        {
          href: '/blog/auto-configuration-system',
          label: 'Auto-Configuration Guide',
          external: false,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/FORKING-GUIDE.md',
          label: 'Forking Guide',
          external: true,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/CREATING_COMPONENTS.md',
          label: 'Component Creation',
          external: true,
        },
      ],
    },
    {
      title: 'Architecture',
      description: 'Technical architecture and patterns',
      links: [
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/project/TESTING.md',
          label: 'Testing Strategy',
          external: true,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/ACCESSIBILITY.md',
          label: 'Accessibility Guide',
          external: true,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/PWA.md',
          label: 'PWA Implementation',
          external: true,
        },
      ],
    },
    {
      title: 'Workflows',
      description: 'Development workflows and methodologies',
      links: [
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/PRP-EXECUTION-GUIDE.md',
          label: 'PRP Workflow',
          external: true,
        },
        {
          href: '/blog/spec-kit-workflow',
          label: 'Spec Kit Workflow',
          external: false,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/tree/main/docs/spec-kit',
          label: 'Spec Kit Documentation',
          external: true,
        },
      ],
    },
    {
      title: 'Project Information',
      description: 'Project status and roadmaps',
      links: [
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/project/CHANGELOG.md',
          label: 'Changelog',
          external: true,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/project/CONTRIBUTING.md',
          label: 'Contributing Guide',
          external: true,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/project/SECURITY.md',
          label: 'Security Policy',
          external: true,
        },
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/project/SPRINT-4-ROADMAP.md',
          label: 'Sprint 4 Roadmap',
          external: true,
        },
      ],
    },
    {
      title: 'External Resources',
      description: 'Related tools and resources',
      links: [
        {
          href: 'https://github.com/TortoiseWolfe/ScriptHammer',
          label: 'GitHub Repository',
          external: true,
        },
        {
          href: 'https://github.com/TortoiseWolfe/spec_kit',
          label: 'Spec Kit Repository',
          external: true,
        },
        {
          href: 'https://nextjs.org/docs',
          label: 'Next.js Documentation',
          external: true,
        },
        {
          href: 'https://daisyui.com/docs',
          label: 'DaisyUI Documentation',
          external: true,
        },
      ],
    },
  ];

  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      <header className="mb-8 text-center sm:mb-10 md:mb-12">
        <p className="text-base-content/70 text-base sm:text-lg md:text-xl">
          Everything you need to know about ScriptHammer
        </p>
      </header>

      <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
        {docSections.map((section, index) => (
          <div
            key={index}
            className="card bg-base-100 shadow-lg transition-shadow hover:shadow-xl"
          >
            <div className="card-body">
              <h2 className="card-title text-2xl">{section.title}</h2>
              <p className="text-base-content/70 mb-4">{section.description}</p>
              <div className="divider my-2"></div>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary hover:link-hover flex items-center gap-2"
                      >
                        {link.label}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="link link-primary hover:link-hover"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <section className="card bg-primary/10 mt-12">
        <div className="card-body">
          <h2 className="card-title text-2xl">Need Help?</h2>
          <p className="mb-4">
            Can&apos;t find what you&apos;re looking for? Check out these
            resources:
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com/TortoiseWolfe/ScriptHammer/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary min-h-11 min-w-11"
            >
              Report an Issue
            </a>
            <a
              href="https://github.com/TortoiseWolfe/ScriptHammer/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline min-h-11 min-w-11"
            >
              Start a Discussion
            </a>
            <Link href="/contact" className="btn btn-outline min-h-11 min-w-11">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

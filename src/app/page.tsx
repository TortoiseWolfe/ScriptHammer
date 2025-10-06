'use client';

import Link from 'next/link';
import { LayeredScriptHammerLogo } from '@/components/atomic/SpinningLogo';
import { AnimatedLogo } from '@/components/atomic/AnimatedLogo';
import { detectedConfig } from '@/config/project-detected';
import { useEffect } from 'react';

export default function Home() {
  // Apply overflow-hidden only on desktop (screens >= 768px)
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      document.body.style.overflow = isMobile ? '' : 'hidden';
    };

    // Set initial state
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <main className="from-base-200 via-base-100 to-base-200 flex h-[calc(100vh-10rem)] flex-col overflow-x-hidden overflow-y-auto bg-gradient-to-br">
      {/* Skip to main content for accessibility - mobile-first touch target (PRP-017 T036) */}
      <a
        href="#main-content"
        className="btn btn-sm btn-primary sr-only min-h-11 min-w-11 focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
      >
        Skip to main content
      </a>

      {/* Hero Section - Mobile-first responsive padding (PRP-017 T036) */}
      <section
        id="main-content"
        aria-label="Welcome hero"
        className="hero relative flex-1"
      >
        <div className="hero-content px-4 py-6 sm:px-6 sm:py-8 md:py-10 lg:px-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-16">
            {/* Logo - responsive sizes */}
            <div className="flex-shrink-0">
              <div className="h-48 w-48 sm:h-52 sm:w-52 md:h-56 md:w-56 lg:h-[350px] lg:w-[350px]">
                <LayeredScriptHammerLogo speed="slow" pauseOnHover />
              </div>
            </div>

            {/* Content - stacked below logo on mobile */}
            <div className="max-w-full px-6 text-center sm:max-w-2xl sm:px-6 lg:max-w-4xl lg:px-0 lg:text-left">
              {/* Main Title with Animation */}
              <h1 className="mb-4 sm:mb-6">
                <AnimatedLogo
                  text={detectedConfig.projectName}
                  className="!text-lg font-bold min-[400px]:!text-xl min-[480px]:!text-2xl sm:!text-5xl md:!text-6xl lg:!text-7xl"
                  animationSpeed="normal"
                />
              </h1>

              {/* Subtitle - cleaner mobile text */}
              <p className="text-base-content mb-6 text-base leading-relaxed font-medium sm:mb-6 sm:text-xl sm:leading-normal md:text-2xl">
                Opinionated Next.js Template
                <br className="sm:hidden" />
                <span className="mt-1 block sm:mt-0 sm:inline">
                  {' '}
                  with Everything Built-In
                </span>
              </p>

              {/* Tech Stack - hide on smallest screens */}
              <div
                className="mb-8 hidden flex-wrap justify-center gap-2 sm:mb-8 sm:flex md:mb-12 lg:justify-start"
                role="list"
                aria-label="Technology stack"
              >
                <span
                  role="listitem"
                  className="badge badge-outline badge-sm sm:badge-md"
                >
                  Next.js 15.5
                </span>
                <span
                  role="listitem"
                  className="badge badge-outline badge-sm sm:badge-md"
                >
                  React 19
                </span>
                <span
                  role="listitem"
                  className="badge badge-outline badge-sm sm:badge-md"
                >
                  TypeScript
                </span>
                <span
                  role="listitem"
                  className="badge badge-outline badge-sm sm:badge-md"
                >
                  Tailwind CSS
                </span>
                <span
                  role="listitem"
                  className="badge badge-outline badge-sm sm:badge-md"
                >
                  PWA Ready
                </span>
              </div>

              {/* Primary Actions - mobile-first touch targets (PRP-017 T036) */}
              <nav
                aria-label="Primary navigation"
                className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start"
              >
                <Link
                  href="/blog"
                  className="btn btn-accent btn-md group md:btn-lg min-h-11 w-full min-w-11 sm:w-auto"
                >
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  Read Blog
                </Link>
                <a
                  href="https://tortoisewolfe.github.io/ScriptHammer/storybook/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-md group md:btn-lg min-h-11 w-full min-w-11 sm:w-auto"
                >
                  <svg
                    className="mr-2 h-5 w-5 transition-transform group-hover:scale-110"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                    />
                  </svg>
                  View Storybook
                </a>
                <Link
                  href="/themes"
                  className="btn btn-secondary btn-md group md:btn-lg min-h-11 w-full min-w-11 sm:w-auto"
                >
                  <svg
                    className="mr-2 h-5 w-5 transition-transform group-hover:scale-110"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                    />
                  </svg>
                  Browse Themes
                </Link>
                <a
                  href={detectedConfig.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-md group md:btn-lg min-h-11 w-full min-w-11 sm:w-auto"
                >
                  <svg
                    className="mr-2 h-5 w-5 transition-transform group-hover:scale-110"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  View Source
                </a>
              </nav>

              {/* Quick Links - vertical stack on mobile, horizontal on desktop */}
              <nav
                aria-label="Secondary navigation"
                className="mt-8 flex flex-col gap-2 text-sm sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4 sm:text-sm md:mt-10 lg:justify-start"
              >
                <Link
                  href="/status"
                  className="link link-hover opacity-87 hover:opacity-100 focus:opacity-100"
                >
                  Status
                </Link>
                <span
                  className="hidden opacity-30 sm:inline"
                  aria-hidden="true"
                >
                  •
                </span>
                <Link
                  href="/game"
                  className="link link-hover opacity-87 hover:opacity-100 focus:opacity-100"
                >
                  Play Game
                </Link>
                <span
                  className="hidden opacity-30 sm:inline"
                  aria-hidden="true"
                >
                  •
                </span>
                <Link
                  href="/payment-demo"
                  className="link link-hover opacity-87 hover:opacity-100 focus:opacity-100"
                >
                  Payment Demo
                </Link>
                <span
                  className="hidden opacity-30 sm:inline"
                  aria-hidden="true"
                >
                  •
                </span>
                <Link
                  href="/map"
                  className="link link-hover opacity-87 hover:opacity-100 focus:opacity-100"
                >
                  Map
                </Link>
                <span
                  className="hidden opacity-30 sm:inline"
                  aria-hidden="true"
                >
                  •
                </span>
                <Link
                  href="/schedule"
                  className="link link-hover opacity-87 hover:opacity-100 focus:opacity-100"
                >
                  Schedule
                </Link>
                <span
                  className="hidden opacity-30 sm:inline"
                  aria-hidden="true"
                >
                  •
                </span>
                <Link
                  href="/contact"
                  className="link link-hover opacity-87 hover:opacity-100 focus:opacity-100"
                >
                  Contact
                </Link>
                <span
                  className="hidden opacity-30 sm:inline"
                  aria-hidden="true"
                >
                  •
                </span>
                <a
                  href="https://github.com/TortoiseWolfe/ScriptHammer/fork"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-hover opacity-87 hover:opacity-100 focus:opacity-100"
                >
                  Fork
                </a>
              </nav>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section - Mobile-first responsive grid (PRP-017 T036) */}
      <section
        aria-label="Key features"
        className="flex-shrink-0 px-4 py-4 sm:px-6 lg:px-8"
      >
        <div className="container mx-auto">
          <h2 className="sr-only">Key Features</h2>
          <div className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/themes"
              className="card bg-base-100 focus-within:ring-primary cursor-pointer shadow-md transition-all focus-within:ring-2 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="card-body items-center p-4 text-center">
                <div
                  className="mb-3 text-3xl"
                  role="img"
                  aria-label="Artist palette"
                >
                  🎨
                </div>
                <h3 className="card-title text-base">32 Themes</h3>
                <p className="text-base-content/70 text-xs">
                  Light & dark with live switching
                </p>
              </div>
            </Link>

            <Link
              href="/docs/pwa"
              className="card bg-base-100 focus-within:ring-primary cursor-pointer shadow-md transition-all focus-within:ring-2 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="card-body items-center p-4 text-center">
                <div
                  className="mb-3 text-3xl"
                  role="img"
                  aria-label="Mobile phone"
                >
                  📱
                </div>
                <h3 className="card-title text-base">PWA Ready</h3>
                <p className="text-base-content/70 text-xs">
                  Installable with offline support
                </p>
              </div>
            </Link>

            <Link
              href="/accessibility"
              className="card bg-base-100 focus-within:ring-primary cursor-pointer shadow-md transition-all focus-within:ring-2 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="card-body items-center p-4 text-center">
                <div
                  className="mb-3 text-3xl"
                  role="img"
                  aria-label="Wheelchair accessibility symbol"
                >
                  ♿
                </div>
                <h3 className="card-title text-base">Accessible</h3>
                <p className="text-base-content/70 text-xs">
                  WCAG compliant & customizable
                </p>
              </div>
            </Link>

            <Link
              href="/status"
              className="card bg-base-100 focus-within:ring-primary cursor-pointer shadow-md transition-all focus-within:ring-2 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="card-body items-center p-4 text-center">
                <div
                  className="mb-3 text-3xl"
                  role="img"
                  aria-label="Rocket launch"
                >
                  🚀
                </div>
                <h3 className="card-title text-base">Production Ready</h3>
                <p className="text-base-content/70 text-xs">
                  CI/CD, testing & monitoring
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

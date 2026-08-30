import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import ErrorBoundary from './ErrorBoundary';

expect.extend(toHaveNoViolations);

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock('@/utils/error-handler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/error-handler')>();
  return { ...actual, default: { handle } };
});

const Boom = () => {
  throw new Error('kaboom');
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/**
 * The fallback is what a visitor is left with when everything else has failed, so
 * it is the last place that can afford to be inaccessible. At level="page" it is
 * the entire page.
 */
describe('ErrorBoundary Accessibility', () => {
  it.each(['page', 'section', 'component'] as const)(
    'has no violations at level=%s',
    async (level) => {
      const { container } = render(
        <ErrorBoundary level={level}>
          <Boom />
        </ErrorBoundary>
      );
      expect(await axe(container)).toHaveNoViolations();
    }
  );

  it('ANNOUNCES the failure rather than silently swapping the content', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    // Without role=alert a screen-reader user's content is replaced by an error
    // they are never told about — they are simply somewhere else now.
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('gives the error a heading, so it is reachable by heading navigation', () => {
    render(
      <ErrorBoundary level="page">
        <Boom />
      </ErrorBoundary>
    );
    expect(
      screen.getByRole('heading', { name: 'Page Error' })
    ).toBeInTheDocument();
  });

  it('names its recovery actions by what they do', () => {
    render(
      <ErrorBoundary level="page">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Go Home' })).toBeEnabled();
  });

  it('does not convey the error by the icon alone', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    // The warning triangle is decoration; the text carries the meaning.
    expect(
      screen.getByText('This component encountered an error.')
    ).toBeInTheDocument();
  });

  it.fails('meets the 44px touch floor on its recovery buttons', () => {
    // KNOWN GAP (#1013), recorded as a failing expectation so it goes RED when fixed.
    // Both buttons are btn-sm (~32px) against this repo's documented
    // `min-h-11 min-w-11` rule. It has gone unmeasured because
    // mobile-touch-targets.spec.ts can only see controls that render on a normal
    // page, and this fallback needs a crash to appear at all. Filed separately;
    // enlarging them is a visual change, not a rename, so it is not smuggled into
    // a component-structure PR.
    render(
      <ErrorBoundary level="page">
        <Boom />
      </ErrorBoundary>
    );
    for (const name of ['Try Again', 'Go Home']) {
      expect(screen.getByRole('button', { name }).className).toContain(
        'min-h-11'
      );
    }
  });
});

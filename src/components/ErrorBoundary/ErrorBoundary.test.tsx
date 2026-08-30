import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary, { useErrorHandler } from './ErrorBoundary';
import { ErrorSeverity } from '@/utils/error-handler';

// vi.hoisted: the vi.mock factory is hoisted above this file's consts, so a plain
// `const handle = vi.fn()` referenced inside it fails at import time.
const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock('@/utils/error-handler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/error-handler')>();
  return { ...actual, default: { handle } };
});

/** A child that throws on demand. */
const Boom = ({ when = true }: { when?: boolean }) => {
  if (when) throw new Error('kaboom');
  return <p>all fine</p>;
};

beforeEach(() => {
  handle.mockClear();
  // React logs caught errors to console.error; silence it so a passing run is
  // readable, and so a REAL unexpected error still stands out elsewhere.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all fine</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('all fine')).toBeInTheDocument();
  });

  it('catches a throw and shows the fallback instead of crashing', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders a custom fallback when given one', () => {
    render(
      <ErrorBoundary fallback={<p>bespoke fallback</p>}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('bespoke fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it.each([
    [
      'page',
      'Page Error',
      'This page encountered an error and cannot be displayed.',
    ],
    ['section', 'Section Error', 'This section encountered an error.'],
    [
      'component',
      'Something went wrong',
      'This component encountered an error.',
    ],
  ] as const)('says what broke at level=%s', (level, heading, body) => {
    render(
      <ErrorBoundary level={level}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(screen.getByText(body)).toBeInTheDocument();
  });

  it('escalates severity with the level', () => {
    render(
      <ErrorBoundary level="page">
        <Boom />
      </ErrorBoundary>
    );
    // A broken page and a broken widget are not the same incident.
    expect(handle.mock.calls[0][0].severity).toBe(ErrorSeverity.CRITICAL);
  });

  it('reports to the error handler with the component stack', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(handle).toHaveBeenCalledTimes(1);
    const reported = handle.mock.calls[0][0];
    expect(reported.message).toBe('kaboom');
    expect(reported.context.errorBoundary).toBe(true);
    expect(reported.context.componentStack).toBeTruthy();
  });

  it('calls a caller-supplied onError as well', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('kaboom');
  });

  it('recovers when Try Again is pressed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <Boom when={false} />
      </ErrorBoundary>
    );
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('all fine')).toBeInTheDocument();
  });

  it('offers Go Home ONLY at page level', () => {
    const { unmount } = render(
      <ErrorBoundary level="component">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.queryByRole('button', { name: 'Go Home' })).toBeNull();
    unmount();

    render(
      <ErrorBoundary level="page">
        <Boom />
      </ErrorBoundary>
    );
    // A broken section has a page around it to navigate from; a broken page does not.
    expect(screen.getByRole('button', { name: 'Go Home' })).toBeInTheDocument();
  });

  it('resets when a resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['a']}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKeys={['b']}>
        <Boom when={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('all fine')).toBeInTheDocument();
  });

  it('does NOT reset when the resetKeys are unchanged', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['a']}>
        <Boom />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary resetKeys={['a']}>
        <Boom when={false} />
      </ErrorBoundary>
    );
    // Otherwise every re-render would clear the error and the boundary would
    // thrash between fallback and a child that is still broken.
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('resets on changed children when asked to', () => {
    const { rerender } = render(
      <ErrorBoundary resetOnPropsChange>
        <Boom />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary resetOnPropsChange>
        <Boom when={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('all fine')).toBeInTheDocument();
  });

  it('auto-recovers a component-level error after 10 seconds', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ErrorBoundary level="component">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(
      <ErrorBoundary level="component">
        <Boom when={false} />
      </ErrorBoundary>
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('all fine')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('does NOT auto-recover a page-level error', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ErrorBoundary level="page">
        <Boom />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary level="page">
        <Boom when={false} />
      </ErrorBoundary>
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    // Silently re-rendering a page that just died is worse than showing the error.
    expect(screen.getByText('Page Error')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('SHOWS the stack in development', () => {
    // Both directions are stubbed explicitly rather than read from the ambient
    // NODE_ENV. The dev container runs as 'development' and CI as 'test', so a
    // test that depends on which one it happens to be is green in one place and
    // red in the other for no reason anybody can see.
    vi.stubEnv('NODE_ENV', 'development');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Error Details')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it('HIDES the stack in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    // Stacks name internal paths and library versions; they are a development
    // affordance, not something to hand a visitor.
    expect(screen.queryByText('Error Details')).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe('useErrorHandler', () => {
  it('rethrows so a boundary above can catch an async failure', () => {
    const Thrower = () => {
      const throwIt = useErrorHandler();
      throwIt(new Error('from a promise'));
      return null;
    };
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    );
    expect(handle.mock.calls[0][0].message).toBe('from a promise');
  });
});

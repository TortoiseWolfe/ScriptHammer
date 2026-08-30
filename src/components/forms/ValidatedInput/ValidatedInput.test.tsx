import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ValidatedInput } from './ValidatedInput';

const emailSchema = z.string().email('Enter a valid email address');

describe('ValidatedInput', () => {
  it('stays quiet until the field has been touched', async () => {
    const user = userEvent.setup();
    render(
      <ValidatedInput
        name="email"
        aria-label="Email"
        schema={emailSchema}
        debounceMs={0}
      />
    );
    const input = screen.getByLabelText('Email');
    await user.type(input, 'nope');

    // internalError is gated on `touched`, so typing alone must not shout at
    // someone who is still mid-word.
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(
      screen.queryByText('Enter a valid email address')
    ).not.toBeInTheDocument();
  });

  it('validates on blur and wires the error to the input', async () => {
    const user = userEvent.setup();
    render(
      <ValidatedInput name="email" aria-label="Email" schema={emailSchema} />
    );
    const input = screen.getByLabelText('Email');
    await user.type(input, 'nope');
    await user.tab();

    // FormError puts the id on its wrapper and the message in a child <span>, so
    // assert through the id — that is the node aria-describedby actually points at.
    await waitFor(() =>
      expect(document.getElementById('email-error')).toHaveTextContent(
        'Enter a valid email address'
      )
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('clears the error once the value becomes valid', async () => {
    const user = userEvent.setup();
    render(
      <ValidatedInput name="email" aria-label="Email" schema={emailSchema} />
    );
    const input = screen.getByLabelText('Email');
    await user.type(input, 'nope');
    await user.tab();
    await waitFor(() =>
      expect(
        screen.getByText('Enter a valid email address')
      ).toBeInTheDocument()
    );

    await user.clear(input);
    await user.type(input, 'someone@example.com');
    await user.tab();
    await waitFor(() =>
      expect(
        screen.queryByText('Enter a valid email address')
      ).not.toBeInTheDocument()
    );
  });

  it('debounces change validation instead of running per keystroke', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onChange = vi.fn();
    render(
      <ValidatedInput
        name="email"
        aria-label="Email"
        schema={emailSchema}
        debounceMs={300}
        onChange={onChange}
      />
    );
    await user.type(screen.getByLabelText('Email'), 'abc');

    // Each keystroke cancels the previous timer, so three characters must not be
    // three validations — that is the whole point of debounceMs.
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    vi.useRealTimers();
  });

  it('reports validity to onChange, not just the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ValidatedInput
        name="email"
        aria-label="Email"
        schema={emailSchema}
        debounceMs={0}
        onChange={onChange}
      />
    );
    await user.type(screen.getByLabelText('Email'), 'someone@example.com');
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith('someone@example.com', true)
    );
  });

  it('lets an external error override the internal one', () => {
    render(
      <ValidatedInput
        name="email"
        aria-label="Email"
        error="Taken already"
        schema={emailSchema}
      />
    );
    // An external error applies WITHOUT touching the field — a server said so.
    expect(screen.getByText('Taken already')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('forwards the ref to the real input', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<ValidatedInput ref={ref} name="email" aria-label="Email" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('disables while loading', () => {
    render(<ValidatedInput name="email" aria-label="Email" loading />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('keeps a 44px touch target at every size below lg', () => {
    // Mobile-first floor. lg is already taller than 44px on its own.
    for (const size of ['xs', 'sm', 'md'] as const) {
      const { unmount } = render(
        <ValidatedInput name="email" aria-label="Email" size={size} />
      );
      expect(screen.getByLabelText('Email').className).toContain('min-h-11');
      unmount();
    }
  });

  it('marks the state icon decorative so it is not announced', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ValidatedInput name="email" aria-label="Email" schema={emailSchema} />
    );
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.tab();
    await waitFor(() =>
      expect(container.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true'
      )
    );
  });
});

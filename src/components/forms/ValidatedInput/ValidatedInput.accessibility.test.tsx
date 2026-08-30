import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { z } from 'zod';
import { ValidatedInput } from './ValidatedInput';

expect.extend(toHaveNoViolations);

const emailSchema = z.string().email('Enter a valid email address');

describe('ValidatedInput Accessibility', () => {
  it('has no violations in its resting state', async () => {
    const { container } = render(
      <ValidatedInput name="email" aria-label="Email" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations while loading', async () => {
    const { container } = render(
      <ValidatedInput name="email" aria-label="Email" loading />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations once the error is showing', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ValidatedInput name="email" aria-label="Email" schema={emailSchema} />
    );
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.tab();
    await waitFor(() =>
      expect(
        screen.getByText('Enter a valid email address')
      ).toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('describes an id that is actually in the document', async () => {
    // Asserted explicitly, not left to axe. Mutation-testing FormField's twin of
    // this defect showed axe does NOT flag an aria-describedby pointing at a
    // missing id — only this assertion caught it.
    const user = userEvent.setup();
    const { container } = render(
      <ValidatedInput name="email" aria-label="Email" schema={emailSchema} />
    );
    const input = screen.getByLabelText('Email');
    await user.type(input, 'nope');
    await user.tab();
    await waitFor(() =>
      expect(input).toHaveAttribute('aria-describedby', 'email-error')
    );
    expect(container.querySelector('#email-error')).not.toBeNull();
  });

  it('describes NOTHING when there is no error', () => {
    render(<ValidatedInput name="email" aria-label="Email" />);
    // Better an absent attribute than one naming an element that is not there.
    expect(screen.getByLabelText('Email')).not.toHaveAttribute(
      'aria-describedby'
    );
  });
});

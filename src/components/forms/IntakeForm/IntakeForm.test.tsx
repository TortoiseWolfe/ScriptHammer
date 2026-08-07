import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntakeForm, { intakeSchema } from './IntakeForm';

const fill = async (u: ReturnType<typeof userEvent.setup>) => {
  await u.type(screen.getByLabelText(/Your name/), 'Rigo');
  await u.type(screen.getByLabelText(/^Email/), 'rigo@warriorroofing.example');
  await u.type(screen.getByLabelText(/^Phone/), '(423) 555-0137');
  await u.type(screen.getByLabelText(/Business name/), 'Warrior Roofing');
};

describe('IntakeForm', () => {
  it('submits the required fields', async () => {
    const u = userEvent.setup();
    const onSubmit = vi.fn();
    render(<IntakeForm onSubmit={onSubmit} />);
    await fill(u);
    await u.click(screen.getByRole('button', { name: /continue|pay/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Rigo',
      phone: '(423) 555-0137',
      business: 'Warrior Roofing',
    });
  });

  it('REFUSES to submit without a phone number', async () => {
    // FR-013: the catalog sells click-to-call on every build, so this is a
    // product requirement, not form politeness.
    const u = userEvent.setup();
    const onSubmit = vi.fn();
    render(<IntakeForm onSubmit={onSubmit} />);
    await u.type(screen.getByLabelText(/Your name/), 'Rigo');
    await u.type(screen.getByLabelText(/^Email/), 'a@b.co');
    await u.type(screen.getByLabelText(/Business name/), 'Warrior Roofing');
    await u.click(screen.getByRole('button', { name: /continue|pay/i }));
    await waitFor(() =>
      expect(screen.getByText(/Phone is required/)).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('marks the invalid field, not merely the form', async () => {
    const u = userEvent.setup();
    render(<IntakeForm onSubmit={vi.fn()} />);
    await u.click(screen.getByRole('button', { name: /continue|pay/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Email/)).toHaveAttribute(
        'aria-invalid',
        'true'
      )
    );
  });

  it('disables every control while busy', () => {
    render(<IntakeForm onSubmit={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
    expect(screen.getByLabelText(/Your name/)).toBeDisabled();
  });
});

describe('intakeSchema', () => {
  const valid = {
    name: 'Rigo',
    email: 'a@b.co',
    phone: '4235550137',
    business: 'Warrior Roofing',
    domain: '',
    reference_url: '',
    notes: '',
  };

  it('accepts empty optional fields', () => {
    expect(intakeSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a malformed reference URL but allows an empty one', () => {
    expect(
      intakeSchema.safeParse({ ...valid, reference_url: 'not a url' }).success
    ).toBe(false);
    expect(
      intakeSchema.safeParse({ ...valid, reference_url: '' }).success
    ).toBe(true);
  });

  it('lowercases the email so it matches the order record', () => {
    const r = intakeSchema.safeParse({ ...valid, email: 'A@B.CO' });
    expect(r.success && r.data.email).toBe('a@b.co');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import TipJar from './TipJar';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const reduced = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduced(),
}));

describe('TipJar accessibility', () => {
  it('has no axe violations at rest', async () => {
    const { container } = render(<TipJar />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations while showing a validation error', async () => {
    const { container } = render(<TipJar />);
    fireEvent.change(screen.getByLabelText(/amount in whole dollars/i), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send a tip/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('associates the error with the field and marks it invalid', async () => {
    render(<TipJar />);
    const input = screen.getByLabelText(/amount in whole dollars/i);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /send a tip/i }));
    const alert = screen.getByRole('alert');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('every control clears the 44px touch target floor', () => {
    render(<TipJar />);
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toMatch(/min-h-11/);
    }
  });
});

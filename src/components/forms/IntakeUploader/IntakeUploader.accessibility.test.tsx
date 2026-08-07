import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'jest-axe';
import IntakeUploader from './IntakeUploader';
import type { IntakeAttachment } from '@/types/commerce';

vi.mock('@/lib/commerce/intake-upload', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/commerce/intake-upload')
  >('@/lib/commerce/intake-upload');
  return { ...actual, uploadIntakeFile: vi.fn(), removeIntakeFile: vi.fn() };
});

const a: IntakeAttachment = {
  path: 'uid/roof.png',
  name: 'roof.png',
  bytes: 2048,
  mime: 'image/png',
  kind: 'current',
};

describe('IntakeUploader accessibility', () => {
  it('has no axe violations when empty', async () => {
    const { container } = render(
      <IntakeUploader value={[]} onChange={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with attachments', async () => {
    const { container } = render(
      <IntakeUploader value={[a]} onChange={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the dropzone for screen readers', () => {
    render(<IntakeUploader value={[]} onChange={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Add screenshots or sketches' })
    ).toBeInTheDocument();
  });

  // A toggle must announce its state, not just its label.
  it('exposes tag state via aria-pressed rather than colour alone', () => {
    render(<IntakeUploader value={[a]} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'What I have' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'What I want' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('gives the remove control a name that says what it removes', () => {
    render(<IntakeUploader value={[a]} onChange={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Remove roof.png' })
    ).toBeInTheDocument();
  });
});

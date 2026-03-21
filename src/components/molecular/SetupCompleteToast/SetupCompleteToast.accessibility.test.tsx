import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SetupCompleteToast from './SetupCompleteToast';

expect.extend(toHaveNoViolations);

describe('SetupCompleteToast Accessibility', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should have no accessibility violations when visible', async () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    const { container } = render(<SetupCompleteToast />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('uses role=status so screen readers announce it politely', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    render(<SetupCompleteToast />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('dismiss button has accessible label', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    render(<SetupCompleteToast />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('decorative SVG is hidden from AT', () => {
    sessionStorage.setItem('messaging_setup_complete', 'true');
    const { container } = render(<SetupCompleteToast />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

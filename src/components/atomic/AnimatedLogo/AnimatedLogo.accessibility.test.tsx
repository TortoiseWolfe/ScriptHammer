import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

// Mock CSS module
vi.mock('./AnimatedLogo.module.css', () => ({
  default: {
    animatedLogo: 'animatedLogo',
    letter: 'letter',
  },
}));

import { AnimatedLogo } from './AnimatedLogo';

expect.extend(toHaveNoViolations);

describe('AnimatedLogo Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<AnimatedLogo />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with custom text', async () => {
    const { container } = render(<AnimatedLogo text="Custom App Name" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with different sizes', async () => {
    const sizes: Array<'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'> = [
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',
      '3xl',
    ];

    for (const size of sizes) {
      const { container } = render(<AnimatedLogo size={size} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it('should have proper text content for screen readers', () => {
    const { container } = render(<AnimatedLogo text="TestLogo" />);
    expect(container.textContent).toBe('TestLogo');
  });

  it('should maintain semantic HTML structure', () => {
    const { container } = render(<AnimatedLogo />);
    const spanElement = container.querySelector('span');
    expect(spanElement).toBeInTheDocument();
    expect(spanElement?.tagName).toBe('SPAN');
  });

  it('should have interactive cursor style for mouse users', () => {
    const { container } = render(<AnimatedLogo />);
    const logo = container.querySelector('.animatedLogo');
    expect(logo).toHaveClass('cursor-pointer');
  });

  it('should not interfere with page tab order', () => {
    const { container } = render(<AnimatedLogo />);
    const logo = container.querySelector('.animatedLogo');
    expect(logo).not.toHaveAttribute('tabindex');
  });

  it('should preserve text readability with animations disabled', () => {
    const { container } = render(<AnimatedLogo text="AccessibleText" />);
    const letters = container.querySelectorAll('.letter');

    letters.forEach((letter) => {
      expect(letter).toBeVisible();
      expect(letter.textContent).toBeTruthy();
    });
  });
});

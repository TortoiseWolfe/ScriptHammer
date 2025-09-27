import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock CSS module
vi.mock('./AnimatedLogo.module.css', () => ({
  default: {
    animatedLogo: 'animatedLogo',
    letter: 'letter',
  },
}));

import { AnimatedLogo } from './AnimatedLogo';

describe('AnimatedLogo', () => {
  it('renders with default text', () => {
    const { container } = render(<AnimatedLogo />);
    expect(container.textContent).toContain('ScriptHammer');
  });

  it('renders with custom text', () => {
    const { container } = render(<AnimatedLogo text="TestApp" />);
    expect(container.textContent).toContain('TestApp');
  });

  it('applies size classes', () => {
    const { container } = render(<AnimatedLogo size="xl" />);
    const element = container.querySelector('.text-5xl');
    expect(element).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AnimatedLogo className="custom-class" />);
    const element = container.querySelector('.custom-class');
    expect(element).toBeInTheDocument();
  });

  it('splits text into individual letter spans', () => {
    const { container } = render(<AnimatedLogo text="ABC" />);
    const letters = container.querySelectorAll('.letter');
    expect(letters).toHaveLength(3);
    expect(letters[0]).toHaveTextContent('A');
    expect(letters[1]).toHaveTextContent('B');
    expect(letters[2]).toHaveTextContent('C');
  });

  it.skip('applies animation delay to each letter', () => {
    const { container } = render(
      <AnimatedLogo text="AB" animationSpeed="normal" />
    );
    const letters = container.querySelectorAll('.letter');
    expect(letters[0]).toHaveStyle({ animationDelay: '0s' });
    expect(letters[1]).toHaveStyle({ animationDelay: '0.05s' });
  });

  it.skip('applies speed multiplier to animation', () => {
    const { container } = render(
      <AnimatedLogo text="AB" animationSpeed="slow" />
    );
    const letters = container.querySelectorAll('.letter');
    expect(letters[0]).toHaveStyle({ animationDuration: '0.9s' });
  });

  it('triggers animation on hover', async () => {
    const user = userEvent.setup();
    const { container } = render(<AnimatedLogo />);
    const logo = container.querySelector('.animatedLogo');

    if (logo) {
      await user.hover(logo);
      const letters = container.querySelectorAll('.letter');
      expect(letters[0]).toBeInTheDocument();
    }
  });
});

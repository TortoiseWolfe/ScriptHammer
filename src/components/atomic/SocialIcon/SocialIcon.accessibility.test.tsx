import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SocialIcon from './SocialIcon';

describe('SocialIcon Accessibility', () => {
  it('has aria-hidden on decorative SVGs', () => {
    render(<SocialIcon platform="github" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders SVG elements with proper viewBox', () => {
    render(<SocialIcon platform="linkedin" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox');
  });
});

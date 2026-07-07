import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SocialIcon from './SocialIcon';

describe('SocialIcon', () => {
  it('renders without crashing', () => {
    render(<SocialIcon platform="github" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders github icon', () => {
    render(<SocialIcon platform="github" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom className', () => {
    render(<SocialIcon platform="twitter" className="h-8 w-8" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('h-8', 'w-8');
  });

  it('renders default icon for website platform', () => {
    render(<SocialIcon platform="website" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

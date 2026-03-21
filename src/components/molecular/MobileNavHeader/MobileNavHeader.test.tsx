import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MobileNavHeader from './MobileNavHeader';

describe('MobileNavHeader', () => {
  it('renders title text', () => {
    render(<MobileNavHeader title="Messages" />);
    expect(screen.getByText('Messages')).toBeInTheDocument();
  });

  it('renders hamburger icon (SVG present)', () => {
    const { container } = render(<MobileNavHeader title="Messages" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const path = svg?.querySelector('path');
    expect(path).toHaveAttribute('d', 'M4 6h16M4 12h16M4 18h16');
  });

  it('label has aria-label "Open sidebar"', () => {
    render(<MobileNavHeader title="Messages" />);
    const label = screen.getByLabelText('Open sidebar');
    expect(label).toBeInTheDocument();
  });

  it('label has htmlFor="sidebar-drawer"', () => {
    render(<MobileNavHeader title="Messages" />);
    const label = screen.getByLabelText('Open sidebar');
    expect(label).toHaveAttribute('for', 'sidebar-drawer');
  });
});

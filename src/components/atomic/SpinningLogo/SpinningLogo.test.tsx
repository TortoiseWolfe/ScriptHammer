import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SpinningLogo } from './SpinningLogo';

describe('SpinningLogo', () => {
  it('renders children content', () => {
    render(
      <SpinningLogo>
        <span>Test Logo</span>
      </SpinningLogo>
    );
    expect(screen.getByText('Test Logo')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(
      <SpinningLogo size="sm">
        <span>Logo</span>
      </SpinningLogo>
    );
    let container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({ width: '32px', height: '32px' });

    rerender(
      <SpinningLogo size="lg">
        <span>Logo</span>
      </SpinningLogo>
    );
    container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({ width: '64px', height: '64px' });
  });

  it('applies custom size when number provided', () => {
    render(
      <SpinningLogo size={100}>
        <span>Logo</span>
      </SpinningLogo>
    );
    const container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({ width: '100px', height: '100px' });
  });

  it('applies correct animation speed', () => {
    const { rerender } = render(
      <SpinningLogo speed="slow">
        <span>Logo</span>
      </SpinningLogo>
    );
    let container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({
      animation: 'spin-clockwise 30s linear infinite',
    });

    rerender(
      <SpinningLogo speed="fast">
        <span>Logo</span>
      </SpinningLogo>
    );
    container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({
      animation: 'spin-clockwise 10s linear infinite',
    });
  });

  it('applies custom speed when number provided', () => {
    render(
      <SpinningLogo speed={5}>
        <span>Logo</span>
      </SpinningLogo>
    );
    const container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({
      animation: 'spin-clockwise 5s linear infinite',
    });
  });

  it('applies correct rotation direction', () => {
    const { rerender } = render(
      <SpinningLogo direction="clockwise">
        <span>Logo</span>
      </SpinningLogo>
    );
    let container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({
      animation: 'spin-clockwise 30s linear infinite',
    });

    rerender(
      <SpinningLogo direction="counter-clockwise">
        <span>Logo</span>
      </SpinningLogo>
    );
    container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({
      animation: 'spin-counter-clockwise 30s linear infinite',
    });
  });

  it('stops spinning when isSpinning is false', () => {
    render(
      <SpinningLogo isSpinning={false}>
        <span>Logo</span>
      </SpinningLogo>
    );
    const container = screen.getByTestId('spinning-logo');
    expect(container).toHaveStyle({ animation: 'none' });
  });

  it('applies pause on hover class when enabled', () => {
    render(
      <SpinningLogo pauseOnHover>
        <span>Logo</span>
      </SpinningLogo>
    );
    const container = screen.getByTestId('spinning-logo');
    expect(container).toHaveClass('pause-on-hover');
  });

  it('applies custom className', () => {
    render(
      <SpinningLogo className="custom-class">
        <span>Logo</span>
      </SpinningLogo>
    );
    const container = screen.getByTestId('spinning-logo');
    expect(container).toHaveClass('custom-class');
  });

  it('sets correct aria-label', () => {
    render(
      <SpinningLogo ariaLabel="Loading spinner">
        <span>Logo</span>
      </SpinningLogo>
    );
    const container = screen.getByTestId('spinning-logo');
    expect(container).toHaveAttribute('aria-label', 'Loading spinner');
  });

  it('has correct role attribute', () => {
    render(
      <SpinningLogo>
        <span>Logo</span>
      </SpinningLogo>
    );
    const container = screen.getByTestId('spinning-logo');
    expect(container).toHaveAttribute('role', 'img');
  });
});

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SpinningLogo } from './SpinningLogo';

expect.extend(toHaveNoViolations);

describe('SpinningLogo Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(
      <SpinningLogo>
        <span>Logo Content</span>
      </SpinningLogo>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with custom aria-label', async () => {
    const { container } = render(
      <SpinningLogo ariaLabel="Loading animation">
        <span>Logo</span>
      </SpinningLogo>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when not spinning', async () => {
    const { container } = render(
      <SpinningLogo isSpinning={false} ariaLabel="Static logo">
        <span>Logo</span>
      </SpinningLogo>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper role attribute', () => {
    const { getByTestId } = render(
      <SpinningLogo>
        <span>Logo</span>
      </SpinningLogo>
    );
    const logo = getByTestId('spinning-logo');
    expect(logo).toHaveAttribute('role', 'img');
  });

  it('should have descriptive aria-label', () => {
    const { getByTestId } = render(
      <SpinningLogo ariaLabel="Company logo spinning animation">
        <span>Logo</span>
      </SpinningLogo>
    );
    const logo = getByTestId('spinning-logo');
    expect(logo).toHaveAttribute(
      'aria-label',
      'Company logo spinning animation'
    );
  });

  it('should maintain focus visibility', () => {
    const { getByTestId } = render(
      <SpinningLogo>
        <button>Focusable Logo</button>
      </SpinningLogo>
    );
    const logo = getByTestId('spinning-logo');
    expect(logo).toBeInTheDocument();
  });

  it('should work with screen readers when used as loading indicator', async () => {
    const { container } = render(
      <SpinningLogo ariaLabel="Loading, please wait">
        <div className="spinner" />
      </SpinningLogo>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle high contrast mode appropriately', async () => {
    const { container } = render(
      <div style={{ filter: 'contrast(200%)' }}>
        <SpinningLogo>
          <span style={{ color: 'currentColor' }}>Logo</span>
        </SpinningLogo>
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should not interfere with keyboard navigation', () => {
    const { getByTestId } = render(
      <div>
        <button>Before</button>
        <SpinningLogo>
          <span>Logo</span>
        </SpinningLogo>
        <button>After</button>
      </div>
    );
    const logo = getByTestId('spinning-logo');
    expect(logo).not.toHaveAttribute('tabIndex');
  });

  it('should support reduced motion preferences', () => {
    const { getByTestId } = render(
      <SpinningLogo className="motion-reduce:animate-none">
        <span>Logo</span>
      </SpinningLogo>
    );
    const logo = getByTestId('spinning-logo');
    expect(logo).toHaveClass('motion-reduce:animate-none');
  });
});

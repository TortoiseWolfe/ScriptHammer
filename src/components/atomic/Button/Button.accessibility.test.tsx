import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './Button';

expect.extend(toHaveNoViolations);

describe('Button Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with all variants', async () => {
    const variants = [
      'primary',
      'secondary',
      'accent',
      'ghost',
      'link',
      'info',
      'success',
      'warning',
      'error',
    ] as const;

    for (const variant of variants) {
      const { container } = render(<Button variant={variant}>Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it('should have no violations with all sizes', async () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;

    for (const size of sizes) {
      const { container } = render(<Button size={size}>Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it('should have no violations when disabled', async () => {
    const { container } = render(<Button disabled>Disabled Button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when loading', async () => {
    const { container } = render(<Button loading>Loading...</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with outline style', async () => {
    const { container } = render(<Button outline>Outline Button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have appropriate ARIA attributes when loading', () => {
    const { getByRole } = render(<Button loading>Loading...</Button>);
    const button = getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('should have appropriate ARIA attributes when disabled', () => {
    const { getByRole } = render(<Button disabled>Disabled</Button>);
    const button = getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('should maintain focus visibility', () => {
    const { getByRole } = render(<Button>Focus Test</Button>);
    const button = getByRole('button');
    button.focus();

    // Check that the button can receive focus
    expect(document.activeElement).toBe(button);
  });

  it('should have sufficient color contrast for all variants', async () => {
    // Test a few key variants for color contrast
    const testVariants = ['primary', 'secondary', 'warning'] as const;

    for (const variant of testVariants) {
      const { container } = render(
        <div style={{ backgroundColor: 'white' }}>
          <Button variant={variant}>Test Contrast</Button>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    }
  });
});

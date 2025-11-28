import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CodeBlock } from './CodeBlock';

expect.extend(toHaveNoViolations);

describe('CodeBlock Accessibility', () => {
  it('should not have basic accessibility violations', async () => {
    const { container } = render(
      <CodeBlock>{`console.log("Hello, World!");`}</CodeBlock>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels on copy button', () => {
    const { getByRole } = render(<CodeBlock>const x = 42;</CodeBlock>);

    const copyButton = getByRole('button', { name: /copy code to clipboard/i });
    expect(copyButton).toHaveAttribute('aria-label', 'Copy code to clipboard');
    // Title attribute is on the SVG icon, not the button itself
  });

  it('should maintain focus after copying', async () => {
    const { getByRole } = render(<CodeBlock>test code</CodeBlock>);

    const copyButton = getByRole('button', { name: /copy code to clipboard/i });
    copyButton.focus();
    copyButton.click();

    // Button should still have focus after clicking
    expect(document.activeElement).toBe(copyButton);
  });

  it('should have proper semantic structure', () => {
    const { container } = render(
      <CodeBlock language="javascript">const x = 1;</CodeBlock>
    );

    const pre = container.querySelector('pre');
    const code = container.querySelector('code');
    expect(pre).toBeInTheDocument();
    expect(code).toHaveAttribute('data-language', 'javascript');
  });

  it('should be keyboard navigable', () => {
    const { getByRole } = render(<CodeBlock>keyboard test</CodeBlock>);

    const copyButton = getByRole('button', { name: /copy code to clipboard/i });

    // Button should be reachable via keyboard
    expect(copyButton).not.toHaveAttribute('tabindex', '-1');
  });

  it('should work with screen readers', () => {
    const { container, getByRole } = render(
      <CodeBlock>screen reader test</CodeBlock>
    );

    const copyButton = getByRole('button', { name: /copy code to clipboard/i });
    const pre = container.querySelector('pre');

    // Button should have descriptive label for screen readers
    expect(copyButton).toHaveAttribute('aria-label');

    // Pre element should contain the code
    expect(pre).toHaveTextContent('screen reader test');
  });

  it('should handle high contrast mode', () => {
    const { container } = render(
      <CodeBlock className="high-contrast">high contrast code</CodeBlock>
    );

    const pre = container.querySelector('pre');
    expect(pre).toHaveClass('high-contrast');
  });
});

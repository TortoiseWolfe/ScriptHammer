import { cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { expect } from 'vitest';

// Extend Vitest matchers with jest-axe accessibility matchers
expect.extend(toHaveNoViolations);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Custom render function that could include providers if needed
function customRender(ui: React.ReactElement, options = {}) {
  return render(ui, {
    // Wrap with providers if needed
    ...options,
  });
}

// Re-export everything
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { customRender as render };

// Axe configuration for accessibility testing
export const axeConfig = {
  rules: {
    // These can be customized based on project needs
    // Example: 'color-contrast': { enabled: false } to temporarily disable
  },
};

// Helper function to run axe accessibility tests
export async function testAccessibility(container: HTMLElement) {
  const { axe } = await import('jest-axe');
  const results = await axe(container, {
    rules: {
      // WCAG 2.1 AA rules
      'color-contrast': { enabled: true },
      'valid-aria-attributes': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-valid-attr-value': { enabled: true },
      'aria-valid-attr': { enabled: true },
      'button-name': { enabled: true },
      'image-alt': { enabled: true },
      label: { enabled: true },
      'link-name': { enabled: true },
      list: { enabled: true },
      listitem: { enabled: true },
    },
  });

  return results;
}

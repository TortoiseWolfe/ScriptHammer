# Component Accessibility Testing Contract

## Overview

This document defines the contract for accessibility testing of React components using axe-core and jest-axe. It specifies testing patterns, utilities, and requirements for ensuring WCAG AA compliance at the component level.

## Testing Framework Integration

### Jest-Axe Setup

```typescript
// src/utils/accessibility/testing.ts
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Extend Jest matchers globally
expect.extend(toHaveNoViolations);

// Configure axe for component testing
const axe = configureAxe({
  rules: {
    // Disable rules not applicable to component testing
    region: { enabled: false },
    'page-has-heading-one': { enabled: false },
    'landmark-one-main': { enabled: false },

    // Enable important rules for components
    'color-contrast': { enabled: true },
    label: { enabled: true },
    'aria-roles': { enabled: true },
    keyboard: { enabled: true },
    'focus-order-semantics': { enabled: true },
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  resultTypes: ['violations', 'incomplete'],
});

export { axe };
```

### Component Test Utilities

```typescript
// src/utils/accessibility/testing.ts (continued)

/**
 * Test a component for accessibility violations
 */
export async function testAccessibility(
  component: ReactElement,
  options?: {
    rules?: Record<string, any>;
    tags?: string[];
    timeout?: number;
  }
): Promise<void> {
  const { container } = render(component);

  // Wait for any async rendering
  await new Promise((resolve) => setTimeout(resolve, 100));

  const results = await axe(container, {
    rules: options?.rules,
    tags: options?.tags,
  });

  expect(results).toHaveNoViolations();
}

/**
 * Test component with custom render options
 */
export async function testAccessibilityWithOptions(
  component: ReactElement,
  renderOptions?: RenderOptions,
  axeOptions?: any
): Promise<void> {
  const { container } = render(component, renderOptions);
  await new Promise((resolve) => setTimeout(resolve, 100));

  const results = await axe(container, axeOptions);
  expect(results).toHaveNoViolations();
}

/**
 * Test component in different states
 */
export async function testAccessibilityStates(
  componentFactory: (state: any) => ReactElement,
  states: Record<string, any>
): Promise<void> {
  for (const [stateName, stateProps] of Object.entries(states)) {
    const component = componentFactory(stateProps);

    try {
      await testAccessibility(component);
    } catch (error) {
      throw new Error(
        `Accessibility violation in ${stateName} state: ${error.message}`
      );
    }
  }
}
```

## Component Testing Patterns

### Basic Component Test

```typescript
// src/components/subatomic/Button/Button.test.tsx
import { testAccessibility } from '@/utils/accessibility/testing';
import Button from './Button';

describe('Button Accessibility', () => {
  it('should be accessible with default props', async () => {
    await testAccessibility(<Button>Click me</Button>);
  });

  it('should be accessible when disabled', async () => {
    await testAccessibility(<Button disabled>Disabled button</Button>);
  });

  it('should be accessible with different variants', async () => {
    const variants = {
      primary: { variant: 'primary' },
      secondary: { variant: 'secondary' },
      outline: { variant: 'outline' },
      ghost: { variant: 'ghost' }
    };

    await testAccessibilityStates(
      (props) => <Button {...props}>Button text</Button>,
      variants
    );
  });

  it('should be accessible with icons', async () => {
    await testAccessibility(
      <Button>
        <span aria-hidden="true">🚀</span>
        Launch
      </Button>
    );
  });
});
```

### Form Component Test

```typescript
// src/components/atomic/Form/Form.test.tsx
import { testAccessibility, testAccessibilityWithOptions } from '@/utils/accessibility/testing';
import Form from './Form';
import Input from '@/components/subatomic/Input';
import Button from '@/components/subatomic/Button';

describe('Form Accessibility', () => {
  it('should be accessible with proper labels', async () => {
    await testAccessibility(
      <Form>
        <label htmlFor="email">Email Address</label>
        <Input id="email" type="email" required />

        <label htmlFor="password">Password</label>
        <Input id="password" type="password" required />

        <Button type="submit">Submit</Button>
      </Form>
    );
  });

  it('should be accessible with fieldsets', async () => {
    await testAccessibility(
      <Form>
        <fieldset>
          <legend>Personal Information</legend>
          <label htmlFor="firstName">First Name</label>
          <Input id="firstName" type="text" />

          <label htmlFor="lastName">Last Name</label>
          <Input id="lastName" type="text" />
        </fieldset>
      </Form>
    );
  });

  it('should be accessible with error states', async () => {
    await testAccessibility(
      <Form>
        <label htmlFor="email">Email Address</label>
        <Input
          id="email"
          type="email"
          aria-invalid="true"
          aria-describedby="email-error"
        />
        <div id="email-error" role="alert">
          Please enter a valid email address
        </div>
      </Form>
    );
  });
});
```

### Modal Component Test

```typescript
// src/components/atomic/Modal/Modal.test.tsx
import { testAccessibility } from '@/utils/accessibility/testing';
import { render, screen } from '@testing-library/react';
import Modal from './Modal';

describe('Modal Accessibility', () => {
  it('should be accessible when open', async () => {
    await testAccessibility(
      <Modal isOpen={true} onClose={() => {}}>
        <h2>Modal Title</h2>
        <p>Modal content</p>
        <button>Close</button>
      </Modal>
    );
  });

  it('should trap focus within modal', async () => {
    render(
      <div>
        <button>Outside button</button>
        <Modal isOpen={true} onClose={() => {}}>
          <h2>Modal Title</h2>
          <input type="text" placeholder="First input" />
          <input type="text" placeholder="Second input" />
          <button>Modal button</button>
        </Modal>
      </div>
    );

    // Test that modal has proper focus management
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('role', 'dialog');
  });

  it('should be accessible with proper labeling', async () => {
    await testAccessibility(
      <Modal
        isOpen={true}
        onClose={() => {}}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <h2 id="modal-title">Confirmation</h2>
        <p id="modal-description">Are you sure you want to delete this item?</p>
        <button>Confirm</button>
        <button>Cancel</button>
      </Modal>
    );
  });
});
```

## Component Testing Requirements

### Mandatory Tests for All Components

Every component MUST include these accessibility tests:

1. **Basic Accessibility Test**

   ```typescript
   it('should be accessible with default props', async () => {
     await testAccessibility(<Component />);
   });
   ```

2. **State Variation Tests** (if applicable)

   ```typescript
   it('should be accessible in all states', async () => {
     const states = {
       default: {},
       disabled: { disabled: true },
       loading: { loading: true },
       error: { error: 'Error message' }
     };

     await testAccessibilityStates(
       (props) => <Component {...props} />,
       states
     );
   });
   ```

3. **Keyboard Interaction Tests** (if interactive)

   ```typescript
   it('should support keyboard navigation', async () => {
     const { container } = render(<InteractiveComponent />);

     // Test keyboard accessibility
     const element = container.querySelector('[tabindex]') ||
                    container.querySelector('button, input, select, textarea, a');

     if (element) {
       expect(element).toHaveAttribute('tabindex');
       await testAccessibility(<InteractiveComponent />);
     }
   });
   ```

### Component-Specific Requirements

#### Button Components

```typescript
// Required attributes and behaviors
describe('Button Accessibility Requirements', () => {
  it('should have accessible name', async () => {
    // Text content or aria-label required
    await testAccessibility(<Button>Button Text</Button>);
    await testAccessibility(<Button aria-label="Icon button">🚀</Button>);
  });

  it('should indicate disabled state', async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveAttribute('disabled');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('should support focus management', async () => {
    const { container } = render(<Button>Focus me</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveAttribute('tabindex');
  });
});
```

#### Input Components

```typescript
describe('Input Accessibility Requirements', () => {
  it('should have associated label', async () => {
    await testAccessibility(
      <>
        <label htmlFor="test-input">Test Label</label>
        <Input id="test-input" />
      </>
    );
  });

  it('should support error states', async () => {
    await testAccessibility(
      <>
        <label htmlFor="error-input">Input with error</label>
        <Input
          id="error-input"
          aria-invalid="true"
          aria-describedby="error-message"
        />
        <div id="error-message" role="alert">
          This field has an error
        </div>
      </>
    );
  });

  it('should support required state', async () => {
    await testAccessibility(
      <>
        <label htmlFor="required-input">
          Required Field <span aria-hidden="true">*</span>
        </label>
        <Input id="required-input" required aria-required="true" />
      </>
    );
  });
});
```

#### Navigation Components

```typescript
describe('Navigation Accessibility Requirements', () => {
  it('should use proper semantic markup', async () => {
    await testAccessibility(
      <nav aria-label="Main navigation">
        <ul>
          <li><a href="/home">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact" aria-current="page">Contact</a></li>
        </ul>
      </nav>
    );
  });

  it('should indicate current page', async () => {
    const { container } = render(
      <nav>
        <a href="/current" aria-current="page">Current Page</a>
      </nav>
    );

    const currentLink = container.querySelector('[aria-current="page"]');
    expect(currentLink).toBeInTheDocument();
  });
});
```

## Custom Matchers

### Component-Specific Matchers

```typescript
// src/utils/accessibility/matchers.ts
export const customMatchers = {
  toBeAccessibleButton: (received: HTMLElement) => {
    const pass =
      received.tagName === 'BUTTON' &&
      (received.textContent?.trim() || received.getAttribute('aria-label')) &&
      received.hasAttribute('type');

    return {
      pass,
      message: () =>
        pass
          ? `Expected element not to be an accessible button`
          : `Expected element to be an accessible button with text or aria-label and type attribute`,
    };
  },

  toHaveAccessibleName: (received: HTMLElement) => {
    const name =
      received.textContent?.trim() ||
      received.getAttribute('aria-label') ||
      received.getAttribute('aria-labelledby');

    return {
      pass: !!name,
      message: () =>
        name
          ? `Expected element not to have accessible name`
          : `Expected element to have accessible name (text content, aria-label, or aria-labelledby)`,
    };
  },

  toSupportKeyboardNavigation: (received: HTMLElement) => {
    const isKeyboardAccessible =
      received.hasAttribute('tabindex') ||
      ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(received.tagName);

    return {
      pass: isKeyboardAccessible,
      message: () =>
        isKeyboardAccessible
          ? `Expected element not to support keyboard navigation`
          : `Expected element to support keyboard navigation (focusable element or tabindex)`,
    };
  },
};

// Extend Jest matchers
expect.extend(customMatchers);
```

## Testing Configuration Files

### Jest Configuration for Accessibility

```javascript
// jest.config.accessibility.js
module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/*.a11y.test.{js,ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/src/utils/accessibility/jest-setup.ts'],
  testEnvironment: 'jsdom',
  testTimeout: 10000, // Longer timeout for accessibility tests
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    '!src/components/**/*.stories.{ts,tsx}',
    '!src/components/**/index.{ts,tsx}',
  ],
};
```

### Accessibility Test Setup

```typescript
// src/utils/accessibility/jest-setup.ts
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';
import { customMatchers } from './matchers';

// Configure axe-core
const axe = configureAxe({
  rules: {
    region: { enabled: false },
    'page-has-heading-one': { enabled: false },
    'landmark-one-main': { enabled: false },
    'color-contrast': { enabled: true },
    label: { enabled: true },
  },
});

// Extend Jest matchers
expect.extend(toHaveNoViolations);
expect.extend(customMatchers);

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));
```

## CI Integration

### Package.json Scripts

```json
{
  "scripts": {
    "test:a11y:components": "jest --config jest.config.accessibility.js",
    "test:a11y:components:watch": "jest --config jest.config.accessibility.js --watch",
    "test:a11y:components:coverage": "jest --config jest.config.accessibility.js --coverage"
  }
}
```

### GitHub Actions Integration

```yaml
# .github/workflows/accessibility-components.yml
name: Component Accessibility Tests

on:
  push:
    paths:
      - 'src/components/**'
  pull_request:
    paths:
      - 'src/components/**'

jobs:
  component-a11y:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Run component accessibility tests
        run: pnpm test:a11y:components

      - name: Generate coverage report
        run: pnpm test:a11y:components:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/accessibility/lcov.info
```

## Troubleshooting Guide

### Common Issues and Solutions

#### "Element is not focusable" Error

```typescript
// Problem: Testing non-focusable elements for keyboard accessibility
// Solution: Check if element should be focusable
it('should handle non-interactive elements', async () => {
  // For non-interactive elements, don't test keyboard access
  await testAccessibility(<div>Static content</div>);

  // For interactive elements, ensure proper tabindex
  await testAccessibility(<div tabIndex={0} role="button">Interactive div</div>);
});
```

#### "Missing accessible name" Error

```typescript
// Problem: Button or link without accessible name
// Solution: Provide text content or aria-label
await testAccessibility(<Button aria-label="Close dialog">✕</Button>);
await testAccessibility(<Button>Close Dialog</Button>);
```

#### "Color contrast insufficient" Error

```typescript
// Problem: Component styles don't meet contrast requirements
// Solution: Test with specific theme context or disable rule temporarily
await testAccessibility(
  <ThemeProvider theme="high-contrast">
    <Component />
  </ThemeProvider>
);

// Or disable for specific test
await testAccessibility(<Component />, {
  rules: { 'color-contrast': { enabled: false } }
});
```

This contract ensures comprehensive and consistent accessibility testing for all React components in the CRUDkit project, supporting the overall WCAG AA compliance goals.

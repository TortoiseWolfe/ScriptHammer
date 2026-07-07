# Creating Components Guide

This guide explains how to create new components in ScriptHammer following our enforced component structure standards.

## Quick Start

To create a new component, use the Plop generator:

```bash
# Docker (recommended)
docker compose exec scripthammer pnpm run generate:component

# Local
pnpm run generate:component
```

## Interactive Component Generator

When you run the generator, you'll be prompted for:

1. **Component name** (PascalCase, e.g., `ContactForm`, `UserCard`)
2. **Component category**:
   - `subatomic` - Smallest building blocks (Text, Icon, Badge)
   - `atomic` - Basic UI elements (Button, Input, Card)
   - `molecular` - Compound components (FormField, SearchBar)
   - `organisms` - Complex sections (Header, UserProfile)
   - `templates` - Page layouts (DashboardLayout, AuthLayout)
3. **Has props?** - Whether the component will accept props
4. **Include custom hooks?** - Whether to generate a custom hook file

## Generated Structure

The generator creates a complete component with the required 5-file pattern:

```
src/components/{category}/{ComponentName}/
├── index.tsx                             # Barrel export
├── {ComponentName}.tsx                   # Component implementation
├── {ComponentName}.test.tsx              # Unit tests
├── {ComponentName}.stories.tsx           # Storybook stories
└── {ComponentName}.accessibility.test.tsx # Accessibility tests
```

### Example: Creating a ContactForm Component

```bash
$ pnpm run generate:component

? Component name (PascalCase): ContactForm
? Component category: molecular
? Will this component have props? Yes
? Include custom hooks? Yes

✔  ++ /src/components/molecular/ContactForm/index.tsx
✔  ++ /src/components/molecular/ContactForm/ContactForm.tsx
✔  ++ /src/components/molecular/ContactForm/ContactForm.test.tsx
✔  ++ /src/components/molecular/ContactForm/ContactForm.stories.tsx
✔  ++ /src/components/molecular/ContactForm/useContactForm.ts
```

## Generated File Contents

### Component File (`ContactForm.tsx`)

```tsx
'use client';

import React from 'react';

export interface ContactFormProps {
  className?: string;
  onSubmit?: (data: any) => void;
}

export default function ContactForm({
  className = '',
  onSubmit,
}: ContactFormProps) {
  return (
    <div className={`contact-form ${className}`}>
      {/* Component implementation */}
    </div>
  );
}
```

### Test File (`ContactForm.test.tsx`)

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ContactForm from './ContactForm';

describe('ContactForm', () => {
  it('renders without crashing', () => {
    render(<ContactForm />);
    // Add specific assertion based on component content
  });
});
```

### Storybook File (`ContactForm.stories.tsx`)

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs';
import ContactForm from './ContactForm';

const meta: Meta<typeof ContactForm> = {
  title: 'Features/Forms/ContactForm', // Update based on functional category
  component: ContactForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
```

**Note**: After generation, update the `title` field to match the component's functional category:

- Atomic design: `'Atomic Design/Atomic/ComponentName'`
- Feature components: `'Features/CategoryName/ComponentName'` (e.g., Authentication, Payment, Blog, Map)
- Layout/Theme: `'Layout/Theme/ComponentName'`

### Index File (`index.tsx`)

```tsx
export { default } from './ContactForm';
export type { ContactFormProps } from './ContactForm';
```

## Component Standards

All generated components follow these standards:

### TypeScript Requirements

- ✅ Props interface must be exported
- ✅ Use TypeScript strict mode
- ✅ Avoid `any` types
- ✅ Document complex types

### Styling Guidelines

- ✅ Use DaisyUI utility classes
- ✅ Support all 32 themes
- ✅ Include responsive design
- ✅ Follow mobile-first approach

### Testing Requirements

- ✅ Minimum one test per component
- ✅ Test all prop variations
- ✅ Test user interactions
- ✅ Aim for >80% coverage

### Accessibility

- ✅ Include ARIA labels where needed
- ✅ Support keyboard navigation
- ✅ Maintain proper focus management
- ✅ Test with screen readers

## Validation & Compliance

After creating a component, verify it meets standards:

```bash
# Check component structure compliance
docker compose exec scripthammer pnpm run audit:components

# Validate for CI/CD (exits with error if non-compliant)
docker compose exec scripthammer pnpm run validate:structure
```

## Manual Component Creation

If you need to create a component manually, ensure it has all 4 required files:

1. **index.tsx** - Barrel export
2. **ComponentName.tsx** - Implementation with exported Props interface
3. **ComponentName.test.tsx** - At least one test
4. **ComponentName.stories.tsx** - At least one story

### Migration Tool

If you have non-compliant components, use the migration tool:

```bash
# Auto-fix non-compliant components
docker compose exec scripthammer pnpm run migrate:components
```

⚠️ **Note**: The migration creates generic test templates that may need updating.

## Best Practices

### 1. Choose the Right Category

- **subatomic**: No dependencies on other components
- **atomic**: May use subatomic components only
- **molecular**: Can compose atomic and subatomic
- **organisms**: Can use any lower-level components
- **templates**: Layout components, can use any components

### 2. Props Interface

Always export your Props interface:

```tsx
export interface ComponentNameProps {
  // Required props first
  id: string;

  // Optional props with defaults
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;

  // Event handlers
  onClick?: () => void;
  onChange?: (value: string) => void;
}
```

### 3. Component Composition

Use composition over configuration:

```tsx
// Good: Composable
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>

// Avoid: Configuration-heavy
<Card
  headerText="Title"
  bodyContent="Content"
  footerButtons={[...]}
/>
```

### 4. Testing

Write meaningful tests:

```tsx
// Good: Tests behavior
it('calls onSubmit with form data when submitted', async () => {
  const handleSubmit = vi.fn();
  render(<ContactForm onSubmit={handleSubmit} />);

  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

  expect(handleSubmit).toHaveBeenCalledWith({
    email: 'test@example.com',
  });
});

// Avoid: Generic test
it('renders without crashing', () => {
  render(<ContactForm />);
});
```

## Common Patterns

### Form Components

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  email: z.string().email(),
});

export default function ContactForm({ onSubmit }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  // Implementation
}
```

### Loading States

```tsx
const [loading, setLoading] = useState(false);

if (loading) {
  return <div className="loading loading-spinner" />;
}
```

### Error Handling

```tsx
const [error, setError] = useState<string | null>(null);

if (error) {
  return (
    <div className="alert alert-error">
      <span>{error}</span>
    </div>
  );
}
```

## Troubleshooting

### Component Not Passing Validation

Run the audit to see what's missing:

```bash
docker compose exec scripthammer pnpm run audit:components -- --verbose
```

### Tests Failing After Generation

The generator creates basic tests. Update them with proper assertions:

```tsx
// Replace generic selector
expect(screen.getByRole('generic')).toBeInTheDocument();

// With specific selector
expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
```

### Build Errors

Ensure Props interfaces are exported:

```tsx
// Component file
export interface ComponentNameProps {
  /* ... */
}

// Index file
export type { ComponentNameProps } from './ComponentName';
```

## Related Documentation

- [Component Template](./COMPONENT_TEMPLATE.md) - Detailed component patterns
- [Testing Guide](../TESTING.md) - Comprehensive testing guidelines
- [Architecture Decision Records](./adr/) - Component architecture decisions

## Summary

1. Use `pnpm run generate:component` to create components
2. Follow the interactive prompts
3. Update generated tests with meaningful assertions
4. Verify compliance with `pnpm run audit:components`
5. Commit when all checks pass

The component generator ensures consistency and compliance with our component structure standards, making it easy to maintain high-quality, well-tested components across the codebase.

# Accessibility Guidelines

## WCAG 2.1 AA Compliance

This project meets WCAG 2.1 AA standards for web accessibility. We use multiple tools and testing approaches to ensure our components are accessible to all users.

## Testing Tools

### 1. Storybook Addon A11y

All components are tested in Storybook with the a11y addon configured for WCAG 2.1 AA standards.

- View accessibility panel in Storybook for real-time feedback
- Configured in `.storybook/preview.ts`
- Component-specific rules in individual story files

### 2. Jest-Axe

Component-level accessibility tests using jest-axe:

```typescript
import { axe } from 'jest-axe';

it('should have no accessibility violations', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 3. Pa11y CI

Automated page-level accessibility testing:

```bash
# Run against development server
pnpm run test:a11y:dev

# Run in CI environment
pnpm run test:a11y:ci

# Run against specific pages
pa11y http://localhost:3000/themes
```

Configuration in `.pa11yci` tests all main routes.

## Component Requirements

All components must follow the 5-file pattern including accessibility tests:

```
ComponentName/
├── index.tsx
├── ComponentName.tsx
├── ComponentName.test.tsx
├── ComponentName.stories.tsx
└── ComponentName.accessibility.test.tsx  # Required
```

### Automated Accessibility Testing

Every component must include:

```typescript
// ComponentName.accessibility.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ComponentName } from './ComponentName';

describe('ComponentName Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ComponentName />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Development Guidelines

### Semantic HTML

✅ **DO:**

- Use semantic elements (`button`, `nav`, `main`, `article`)
- Maintain proper heading hierarchy (`h1` → `h2` → `h3`)
- Use lists (`ul`, `ol`) for grouped items

❌ **DON'T:**

- Use `div` for clickable elements
- Skip heading levels
- Use generic containers when semantic elements exist

### ARIA Labels

✅ **DO:**

- Add `aria-label` for icon-only buttons
- Use `aria-describedby` for form help text
- Include `role` when semantic HTML isn't available

❌ **DON'T:**

- Use ARIA to fix bad HTML
- Add redundant ARIA labels
- Override native semantics unnecessarily

### Keyboard Navigation

✅ **Required:**

- All interactive elements keyboard accessible
- Visible focus indicators
- Logical tab order
- Escape key closes modals/menus

### Color & Contrast

✅ **Required:**

- 4.5:1 contrast ratio for normal text
- 3:1 contrast ratio for large text
- Don't rely on color alone for meaning
- Test with colorblind filters

### Forms

✅ **Required:**

- Label all inputs
- Group related fields with fieldset
- Provide error messages with context
- Mark required fields clearly

## Testing Checklist

- [ ] Component passes jest-axe tests
- [ ] Zero violations in Storybook a11y panel
- [ ] Keyboard navigation works
- [ ] Screen reader announces properly
- [ ] Focus indicators visible
- [ ] Color contrast meets standards
- [ ] Works with colorblind mode
- [ ] Pa11y CI tests pass

```
ComponentName/
├── index.tsx                           # Barrel export
├── ComponentName.tsx                   # Main component
├── ComponentName.test.tsx              # Unit tests
├── ComponentName.stories.tsx           # Storybook stories
└── ComponentName.accessibility.test.tsx # Accessibility tests
```

## Key Accessibility Features

### 1. Semantic HTML

- Use proper heading hierarchy (h1, h2, h3)
- Use semantic elements (article, header, nav, main)
- Use button elements for interactive actions

### 2. ARIA Attributes

- Add aria-label for icon-only buttons
- Use aria-busy for loading states
- Use aria-disabled for disabled states
- Provide aria-describedby for form fields

### 3. Keyboard Navigation

- All interactive elements must be keyboard accessible
- Focus indicators must be visible
- Tab order must be logical

### 4. Color Contrast

- Text must meet WCAG AA contrast ratios
- 4.5:1 for normal text
- 3:1 for large text (18px+ or 14px+ bold)

### 5. Screen Reader Support

- All images must have alt text
- Form fields must have labels
- Error messages must be associated with fields

## Testing Workflow

1. **Development**: Use Storybook a11y addon for immediate feedback
2. **Pre-commit**: Component accessibility tests run automatically
3. **CI/CD**: Pa11y CI tests all pages on pull requests
4. **Manual Testing**: Test with screen readers and keyboard navigation

## Common Issues and Fixes

### Issue: Color contrast failures

**Fix**: Use DaisyUI theme colors which are designed for accessibility

### Issue: Missing button labels

**Fix**: Add aria-label to icon-only buttons

### Issue: Form fields without labels

**Fix**: Use proper label elements or aria-label

### Issue: Images without alt text

**Fix**: Add descriptive alt text or alt="" for decorative images

## Continuous Improvement

- Run `pnpm run audit:components` to check component compliance
- Review Storybook a11y panel regularly during development
- Monitor GitHub Actions accessibility workflow for failures
- Update this documentation as new patterns emerge

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Resources](https://webaim.org/resources/)
- [Axe DevTools](https://www.deque.com/axe/devtools/)
- [Pa11y Documentation](https://pa11y.org/)

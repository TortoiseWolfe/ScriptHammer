# Contributing to ScriptHammer

Thank you for your interest in contributing to ScriptHammer. This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Prerequisites](#prerequisites)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Component Guidelines](#component-guidelines)
- [Testing Requirements](#testing-requirements)
- [Submitting Changes](#submitting-changes)
- [Style Guide](#style-guide)

---

## Code of Conduct

Be respectful, inclusive, and constructive. We welcome contributors of all experience levels.

---

## Prerequisites

- **Docker Desktop** (required) - All development happens in containers
- **Git** - Version control
- **Code editor** - VS Code recommended with Docker extension

**Important**: Local Node.js/pnpm installation is NOT required. All tooling runs inside Docker.

---

## Development Environment

### Initial Setup

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/ScriptHammer.git
cd ScriptHammer

# 3. Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/ScriptHammer.git

# 4. Start the development environment
docker compose up -d

# 5. Verify containers are running
docker compose ps
```

### Running Commands

All commands run inside the Docker container:

```bash
# Enter the container shell
docker compose exec app sh

# Or run commands directly
docker compose exec app pnpm run dev
docker compose exec app pnpm run test
docker compose exec app pnpm run lint
```

**Never run `npm install` or `pnpm install` on your host machine.** This violates the Docker-first principle and may cause inconsistencies.

### Wireframe Viewer

To preview SVG wireframes during development:

```bash
cd docs/design/wireframes
npm run dev
# Opens at http://localhost:3000
```

---

## Project Structure

```
ScriptHammer/
├── features/                    # Feature specifications (PRPs)
│   ├── foundation/              # Core features (000-006)
│   ├── core-features/           # Main features (007-012)
│   ├── auth-oauth/              # Auth features (013-016)
│   └── ...
├── docs/
│   ├── design/wireframes/       # SVG wireframes + viewer
│   ├── blog/                    # Technical blog posts
│   └── interoffice/             # Internal documentation
├── src/                         # Application source (when implemented)
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # React components (5-file pattern)
│   ├── lib/                     # Utility functions
│   └── hooks/                   # Custom React hooks
├── .specify/                    # SpecKit configuration
│   ├── memory/                  # Constitution + inventory
│   └── templates/               # Output templates
└── scripts/                     # Automation scripts
```

---

## Making Changes

### Branch Naming

Use descriptive branch names with a prefix:

| Prefix      | Purpose           | Example                 |
| ----------- | ----------------- | ----------------------- |
| `feature/`  | New functionality | `feature/add-dark-mode` |
| `fix/`      | Bug fixes         | `fix/login-redirect`    |
| `docs/`     | Documentation     | `docs/update-api-guide` |
| `refactor/` | Code improvements | `refactor/auth-service` |
| `test/`     | Test additions    | `test/payment-flows`    |

```bash
# Create a new branch
git checkout -b feature/your-feature-name
```

### Workflow for Features

ScriptHammer uses the SpecKit workflow for feature development:

```bash
# 1. Specification phase
/speckit.specify        # Generate spec.md from feature file
/speckit.clarify        # Refine requirements interactively

# 2. Design phase
/wireframe              # Generate SVG wireframes
/wireframe-review       # Review and classify issues
# Repeat until all wireframes pass

# 3. Implementation phase
/speckit.plan           # Generate implementation plan
/speckit.tasks          # Generate task breakdown
/speckit.implement      # Execute implementation
```

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Merge into your branch
git checkout main
git merge upstream/main

# Update your feature branch
git checkout feature/your-feature
git rebase main
```

---

## Component Guidelines

### 5-File Pattern (Mandatory)

Every component MUST have exactly 5 files:

```
src/components/Button/
├── index.tsx                    # Re-exports
├── Button.tsx                   # Component implementation
├── Button.test.tsx              # Unit tests (Vitest)
├── Button.stories.tsx           # Storybook stories
└── Button.accessibility.test.tsx # Pa11y a11y tests
```

Use the component generator to ensure compliance:

```bash
docker compose exec app pnpm run generate:component Button
```

### Component Structure

```tsx
// Button.tsx
import { type ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`btn btn-${variant} btn-${size}`} {...props}>
      {children}
    </button>
  );
}
```

```tsx
// index.tsx
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

---

## Testing Requirements

### Test-First Development

Write tests BEFORE implementation (RED-GREEN-REFACTOR):

1. **RED**: Write a failing test
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve code while tests pass

### Minimum Coverage

| Type          | Minimum        | Tool       |
| ------------- | -------------- | ---------- |
| Unit tests    | 25%            | Vitest     |
| E2E tests     | Critical paths | Playwright |
| Accessibility | All components | Pa11y      |

### Running Tests

```bash
# All tests
docker compose exec app pnpm run test

# Unit tests only
docker compose exec app pnpm run test:unit

# E2E tests
docker compose exec app pnpm run test:e2e

# Accessibility tests
docker compose exec app pnpm run test:a11y

# Watch mode for development
docker compose exec app pnpm run test:watch
```

### Test File Examples

```tsx
// Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies variant class', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-secondary');
  });
});
```

```tsx
// Button.accessibility.test.tsx
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import { Button } from './Button';

expect.extend(toHaveNoViolations);

describe('Button Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Accessible</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Submitting Changes

### Pre-Submission Checklist

- [ ] Code follows [Style Guide](#style-guide)
- [ ] All tests pass (`pnpm run test`)
- [ ] Linting passes (`pnpm run lint`)
- [ ] Build succeeds (`pnpm run build`)
- [ ] Components follow 5-file pattern
- [ ] New features have wireframes reviewed
- [ ] Documentation updated if needed

### Commit Messages

Use clear, descriptive commit messages:

```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude <name> <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:

```bash
feat(auth): add password reset flow

Implements forgot password and reset password pages with
email verification via Supabase Auth.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```bash
fix(messaging): resolve group chat notification bug

Messages in group chats now correctly trigger notifications
for all members except the sender.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Pull Request Process

1. **Push your branch**

   ```bash
   git push origin feature/your-feature
   ```

2. **Create PR on GitHub**
   - Use a descriptive title
   - Fill out the PR template
   - Link related issues

3. **PR Description Template**

   ```markdown
   ## Summary

   Brief description of changes (1-3 bullet points)

   ## Changes

   - Added X
   - Modified Y
   - Removed Z

   ## Testing

   - [ ] Unit tests added/updated
   - [ ] E2E tests added/updated
   - [ ] Manual testing completed

   ## Screenshots

   (if applicable)

   ## Related Issues

   Closes #123
   ```

4. **Address Review Feedback**
   - Respond to all comments
   - Push fixes as new commits
   - Request re-review when ready

5. **Merge Requirements**
   - All CI checks pass
   - At least one approval
   - No unresolved conversations

---

## Style Guide

### TypeScript

- Use strict mode (`"strict": true`)
- Prefer interfaces over types for objects
- Export types alongside components
- Use explicit return types on functions

```tsx
// Good
export interface UserProps {
  name: string;
  email: string;
}

export function User({ name, email }: UserProps): JSX.Element {
  return (
    <div>
      {name} ({email})
    </div>
  );
}

// Avoid
export type UserProps = { name: string; email: string };
export const User = ({ name, email }) => <div>{name}</div>;
```

### React

- Use functional components with hooks
- Prefer named exports
- Keep components focused (single responsibility)
- Use composition over inheritance

### CSS/Tailwind

- Use Tailwind utilities for styling
- Use DaisyUI components when available
- Follow mobile-first responsive design
- Ensure 44px minimum touch targets

```tsx
// Good - mobile-first
<button className="p-4 text-sm md:text-base lg:p-6">
  Click
</button>

// Avoid - desktop-first
<button className="p-6 lg:p-4">
  Click
</button>
```

### Accessibility

- All interactive elements must be keyboard accessible
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Include ARIA labels where needed
- Maintain color contrast ratios (WCAG AA)
- Test with screen readers

---

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/OWNER/ScriptHammer/discussions)
- **Bugs**: Open an [Issue](https://github.com/OWNER/ScriptHammer/issues)
- **Security**: Email security@example.com (do not open public issues)

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to ScriptHammer!

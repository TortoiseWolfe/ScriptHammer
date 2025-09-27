# CRUDkit Development Guidelines for Claude

Auto-generated from all feature plans. Last updated: [DATE]

## Active Technologies
- **Frontend**: Next.js 15.5, React 19, TypeScript 5.9
- **Styling**: Tailwind CSS 4, DaisyUI (32 themes)
- **Testing**: Vitest, Playwright, Pa11y, React Testing Library
- **PWA**: Service Worker, IndexedDB, Background Sync
- **Build**: pnpm 10.16.1, Docker Compose, GitHub Actions

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   └── [pages]/           # Application pages
├── components/            # Atomic design pattern
│   ├── atomic/           # Basic components (Button, Card, etc.)
│   ├── subatomic/        # Primitives (Text, etc.)
│   ├── privacy/          # GDPR components
│   └── theme/            # Theme switching
├── config/               # Project configuration
│   ├── project-detected.ts  # Auto-detected config
│   └── fonts.ts          # Font configuration
├── contexts/             # React contexts
│   ├── ConsentContext.tsx
│   └── AccessibilityContext.tsx
├── hooks/                # Custom React hooks
├── schemas/              # Zod validation schemas
├── tests/                # Integration tests
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

## Essential Commands

### Component Generation (MANDATORY)
```bash
# ALWAYS use the generator - manual creation will fail CI/CD
pnpm run generate:component ComponentName

# This creates the required 5-file structure:
# - index.tsx
# - ComponentName.tsx
# - ComponentName.test.tsx
# - ComponentName.stories.tsx
# - ComponentName.accessibility.test.tsx
```

### Docker Development (Preferred)
```bash
docker compose up                        # Start all services
docker compose exec crudkit pnpm dev     # Dev server in container
docker compose exec crudkit pnpm test    # Run tests in container
pnpm run docker:clean                    # Clean start if issues
```

### Testing Commands
```bash
pnpm test                # Unit tests with Vitest
pnpm test:e2e           # E2E tests with Playwright (local only)
pnpm test:a11y          # Accessibility tests with Pa11y
pnpm test:coverage      # Generate coverage report (target: 58%+)
pnpm run storybook      # Component documentation
```

### Code Quality
```bash
pnpm run lint           # ESLint checks
pnpm run type-check     # TypeScript validation
pnpm run format         # Prettier formatting
pnpm run validate:structure  # Component structure validation
```

### PRP Workflow Commands
```bash
# Create feature branch from PRP
./scripts/prp-to-feature.sh <prp-name> <number>

# Sprint planning
pnpm run sprint:plan    # Generate sprint plan
pnpm run sprint:status  # Check current status
pnpm run sprint:spec    # Generate specification
pnpm run sprint:tasks   # Generate task list
```

## Code Style

### TypeScript/React
- Strict mode enabled
- Functional components with hooks
- Props interfaces named `ComponentNameProps`
- Use `'use client'` directive for client components
- Prefer composition over inheritance

### Component Patterns
```tsx
// Required structure (use generator!)
export interface ComponentNameProps {
  // Props definition
}

export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  // Implementation
  return <div>...</div>;
}
```

### Testing Patterns
```tsx
// Vitest + React Testing Library
import { render, screen } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByRole('...')).toBeInTheDocument();
  });
});
```

## Constitutional Principles

### I. Component Structure Compliance
- ALWAYS use `pnpm run generate:component`
- NEVER create components manually
- 5-file pattern is enforced by CI/CD

### II. Test-First Development
- Write tests BEFORE implementation
- Follow RED-GREEN-REFACTOR cycle
- Minimum 25% coverage, 58%+ target

### III. PRP Methodology
- Features follow: spec → plan → tasks → implement
- Track progress in PRP status dashboard
- Clear success criteria required

### IV. Docker-First Development
- Use Docker Compose for consistency
- Debug environment issues in Docker first
- Production assumes containerization

### V. Progressive Enhancement
- Core functionality without JavaScript
- PWA with offline support
- Accessibility features (colorblind, fonts)
- Mobile-first responsive design

### VI. Privacy & Compliance First
- GDPR compliance mandatory
- Consent before any tracking
- Privacy controls accessible
- Third-party services need modals

## Recent Changes

### Sprint 3.5 (Completed 2025-09-19)
- Fixed Next.js 15.5 static export
- Resolved Husky Docker detection
- Optimized font loading for CLS
- 46 technical debt items cleared

### Latest PRPs
- PRP-014: Geolocation Map (Leaflet.js)
- PRP-013: Calendar Integration (Calendly/Cal.com)
- PRP-011: PWA Background Sync
- PRP-010: EmailJS Integration

## Common Issues & Solutions

### Component Structure Validation Failed
```bash
# Use the generator instead of manual creation
pnpm run generate:component MyComponent
```

### Docker Permission Issues
```bash
# Create .env file with your UID/GID
echo "UID=$(id -u)" > .env
echo "GID=$(id -g)" >> .env
```

### Webpack Cache Corruption
```bash
pnpm run docker:clean  # Or: rm -rf .next
```

### Tests Failing After Component Changes
```bash
# Ensure you're following TDD
# 1. Write/update tests first
# 2. Run tests (should fail)
# 3. Implement changes
# 4. Tests should pass
```

## PRP Implementation Flow

When implementing a PRP:

1. **Spec Phase**: Define WHAT needs to be built
2. **Plan Phase**: Technical approach, constitution check
3. **Tasks Phase**: Detailed task breakdown with TDD
4. **Implementation**: Execute tasks in order

Always check `/docs/prp-docs/PRP-STATUS.md` for current progress.

<!-- MANUAL ADDITIONS START -->
<!-- Add project-specific notes here that should persist -->
<!-- MANUAL ADDITIONS END -->
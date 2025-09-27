# Contributing to CRUDkit

Thank you for your interest in contributing to CRUDkit! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully
- Prioritize the project's best interests

## Getting Started

### Prerequisites

- Docker and Docker Compose (MANDATORY)
- Git
- Node.js 18+ (only needed on host for git hooks)

### Setting Up Your Development Environment

1. **Fork the Repository**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/CRUDkit.git
   cd CRUDkit
   ```

2. **Setup Docker Environment**

   ```bash
   # Create .env file with your user ID
   echo "UID=$(id -u)" > .env
   echo "GID=$(id -g)" >> .env

   # Start Docker development environment (MANDATORY)
   docker compose up
   ```

   **NOTE**: This project REQUIRES Docker. Local pnpm/npm is NOT supported.

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

## Development Workflow

### Docker Development (MANDATORY)

**⚠️ IMPORTANT**: This project REQUIRES Docker to ensure consistent development environments.

```bash
# Start development environment
docker compose up

# Run commands in container
docker compose exec scripthammer pnpm dev       # Dev server
docker compose exec scripthammer pnpm test      # Run tests
docker compose exec scripthammer pnpm lint      # Run linting
docker compose exec scripthammer pnpm format    # Format code
docker compose exec scripthammer pnpm storybook  # Storybook
docker compose exec scripthammer pnpm type-check # TypeScript
```

### Available Scripts (Run Inside Docker)

| Script                                                | Description                      |
| ----------------------------------------------------- | -------------------------------- |
| `docker compose exec scripthammer pnpm dev`           | Start Next.js development server |
| `docker compose exec scripthammer pnpm build`         | Build for production             |
| `docker compose exec scripthammer pnpm test`          | Run Vitest tests                 |
| `docker compose exec scripthammer pnpm test:coverage` | Generate coverage report         |
| `docker compose exec scripthammer pnpm lint`          | Run ESLint                       |
| `docker compose exec scripthammer pnpm format`        | Format code with Prettier        |
| `docker compose exec scripthammer pnpm format:check`  | Check formatting without changes |
| `docker compose exec scripthammer pnpm type-check`    | Run TypeScript type checking     |
| `docker compose exec scripthammer pnpm storybook`     | Start Storybook development      |

## Coding Standards

### TypeScript

- We use TypeScript with strict mode enabled
- All new code must be properly typed (no `any` unless absolutely necessary)
- Use interfaces for object shapes, types for unions/primitives
- Export types/interfaces that might be used elsewhere

### Code Style

- Code is automatically formatted with Prettier on commit
- Follow the existing patterns in the codebase
- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for public APIs

### Component Guidelines

We follow Atomic Design principles:

```
src/components/
├── subatomic/    # Basic elements (Text, Button, Input)
├── atomic/       # Simple components (Card, Modal)
├── molecular/    # Composite components
└── organisms/    # Complex sections
```

- Components should be in their own folders with:
  - `ComponentName.tsx` - Component file
  - `ComponentName.test.tsx` - Test file
  - `ComponentName.stories.tsx` - Storybook stories
  - `index.ts` - Export file

### Git Commit Messages

We use conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or fixes
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements

Examples:

```bash
feat(auth): add OAuth2 integration
fix(ui): resolve theme switcher flickering
docs: update installation instructions
```

## Testing

### Writing Tests

- Write tests for all new features and bug fixes
- Place tests next to the code they test (`Component.test.tsx`)
- Use descriptive test names that explain the behavior
- Follow the AAA pattern: Arrange, Act, Assert

### Running Tests

```bash
# Run all tests (inside Docker)
docker compose exec scripthammer pnpm test

# Run tests in watch mode
docker compose exec scripthammer pnpm test:watch

# Generate coverage report
docker compose exec scripthammer pnpm test:coverage
```

### Coverage Requirements

Current minimum coverage thresholds:

- Statements: 0.5%
- Branches: 0.5%
- Functions: 0.5%
- Lines: 0.5%

These will increase as the project matures.

## Submitting Changes

### Pre-commit Checks

Our pre-commit hooks automatically:

1. Format code with Prettier
2. Lint with ESLint
3. Run related tests
4. Check TypeScript types

### Pull Request Process

1. **Update Documentation**
   - Update README.md if needed
   - Add/update tests
   - Update Storybook stories for UI changes

2. **Ensure Quality**
   - All tests pass
   - No linting errors
   - Code is formatted
   - TypeScript has no errors

3. **Create Pull Request**
   - Use a clear, descriptive title
   - Reference any related issues
   - Provide a detailed description of changes
   - Include screenshots for UI changes

4. **PR Template**

   ```markdown
   ## Description

   Brief description of changes

   ## Type of Change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing

   - [ ] Tests pass locally
   - [ ] Added new tests
   - [ ] Updated existing tests

   ## Checklist

   - [ ] Code follows project style
   - [ ] Self-reviewed code
   - [ ] Updated documentation
   - [ ] No console errors/warnings
   ```

### Review Process

- PRs require at least one review
- Address all feedback constructively
- Keep PRs focused and reasonably sized
- Be patient - reviewers are volunteers

## Reporting Issues

### Before Creating an Issue

1. Check existing issues (including closed ones)
2. Verify you're using the latest version
3. Try to reproduce in a clean environment

### Creating an Issue

Include:

- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/error messages
- Environment details (OS, browser, Node version)

### Issue Templates

We provide templates for:

- Bug reports
- Feature requests
- Documentation improvements
- Performance issues

## Project Structure

```
CRUDkit/
├── .github/           # GitHub Actions and templates
├── .husky/            # Git hooks
├── .storybook/        # Storybook configuration
├── public/            # Static assets
├── src/
│   ├── app/          # Next.js app router pages
│   ├── components/   # React components
│   ├── contexts/     # React contexts
│   ├── utils/        # Utility functions
│   └── test/         # Test utilities
├── docs/             # Documentation
└── docker-compose.yml # Docker configuration
```

## Getting Help

- Check the [documentation](./docs/)
- Review [existing issues](https://github.com/TortoiseWolfe/ScriptHammer/issues)
- Ask in discussions
- Read the [README](./README.md)

## Recognition

Contributors are recognized in:

- The project README
- Release notes
- GitHub contributors page

Thank you for contributing to CRUDkit! 🎉

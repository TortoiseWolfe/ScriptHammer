# Getting Started with ScriptHammer

Get your development environment running in under 10 minutes.

---

## Prerequisites

| Requirement    | Version | Purpose                 |
| -------------- | ------- | ----------------------- |
| Docker Desktop | 4.0+    | Development environment |
| Git            | 2.30+   | Version control         |
| Code editor    | Any     | VS Code recommended     |

**Note**: You do NOT need Node.js or pnpm installed locally. Everything runs inside Docker containers.

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_ORG/ScriptHammer.git
cd ScriptHammer
```

### 2. Start Docker Environment

```bash
# Start all containers
docker compose up -d

# Verify containers are running
docker compose ps
```

Expected output:

```
NAME                    STATUS
scripthammer-app        running
scripthammer-db         running (if applicable)
```

### 3. Verify Installation

```bash
# Enter the container
docker compose exec app sh

# Check Node version
node --version
# Expected: v20.x.x

# Check pnpm
pnpm --version
# Expected: 8.x.x

# Exit container
exit
```

### 4. Run the Wireframe Viewer

```bash
cd docs/design/wireframes
npm install
npm run dev
```

Open http://localhost:3000 to browse feature wireframes.

---

## Project Overview

ScriptHammer is a **planning template** for AI-assisted development. It contains:

- **46 feature specifications** - Detailed requirements for each feature
- **SVG wireframes** - Visual designs for desktop and mobile
- **SpecKit workflow** - Structured process from spec to implementation
- **Multi-terminal orchestration** - 21 specialized Claude Code terminals

**No application code exists yet.** This is spec-first planning.

---

## Project Structure

```
ScriptHammer/
│
├── features/                    # Feature specifications
│   ├── IMPLEMENTATION_ORDER.md  # Build sequence (read this first!)
│   ├── foundation/              # 000-006: RLS, Auth, a11y
│   ├── core-features/           # 007-012: Messaging, Blog
│   ├── auth-oauth/              # 013-016: OAuth improvements
│   ├── enhancements/            # 017-021: PWA, Analytics
│   ├── integrations/            # 022-026: Payments, Forms
│   ├── polish/                  # 027-030: UX refinements
│   ├── testing/                 # 031-037: Test suites
│   ├── payments/                # 038-043: Payment features
│   └── code-quality/            # 044-045: Error handling
│
├── docs/
│   ├── design/wireframes/       # SVG wireframes + viewer
│   ├── blog/                    # Technical articles
│   ├── getting-started/         # You are here
│   └── interoffice/             # Internal docs, RFCs, audits
│
├── .specify/                    # SpecKit configuration
│   ├── memory/constitution.md   # 6 core principles
│   └── templates/               # Output templates
│
├── .claude/                     # Claude Code configuration
│   ├── roles/                   # Terminal role definitions
│   └── inventories/             # Context files
│
└── scripts/                     # Automation scripts
    └── AUTOMATION.md            # Multi-terminal patterns
```

---

## Key Documents

Start by reading these files:

| Document             | Location                                    | Purpose                          |
| -------------------- | ------------------------------------------- | -------------------------------- |
| Implementation Order | `features/IMPLEMENTATION_ORDER.md`          | Which features to build first    |
| Constitution         | `.specify/memory/constitution.md`           | 6 mandatory principles           |
| Feature Template     | `features/CLAUDE.md`                        | How feature specs are structured |
| Wireframe Index      | `docs/design/wireframes/WIREFRAME_INDEX.md` | All 46 wireframe sets            |

---

## Tech Stack

When implementation begins, the project uses:

| Layer           | Technology                  | Notes                             |
| --------------- | --------------------------- | --------------------------------- |
| Framework       | Next.js 15+                 | App Router, static export         |
| UI              | React 19+                   | TypeScript strict mode            |
| Styling         | Tailwind CSS 4 + DaisyUI    | Mobile-first                      |
| Backend         | Supabase                    | Auth, DB, Storage, Edge Functions |
| Testing         | Vitest + Playwright + Pa11y | Unit, E2E, a11y                   |
| Package Manager | pnpm                        | Inside Docker only                |

**Critical Constraint**: Static export to GitHub Pages. No server-side API routes.

---

## SpecKit Workflow

Features are implemented using a structured 9-phase workflow:

### Phase 1: Specification

```bash
/speckit.specify    # Generate spec.md from feature file
/speckit.clarify    # Refine requirements with questions
```

### Phase 2: Design

```bash
/wireframe          # Generate SVG wireframes
/wireframe-review   # Review and classify issues
# Repeat until all pass
```

### Phase 3: Implementation

```bash
/speckit.plan       # Generate implementation plan
/speckit.checklist  # Generate verification checklist
/speckit.tasks      # Generate task breakdown
/speckit.analyze    # Check cross-artifact consistency
/speckit.implement  # Execute implementation
```

**All phases are mandatory.** Do not skip steps.

---

## Common Commands

### Docker Commands

```bash
# Start environment
docker compose up -d

# Stop environment
docker compose down

# View logs
docker compose logs -f app

# Rebuild after Dockerfile changes
docker compose build --no-cache
```

### Inside Container

```bash
# Enter container shell
docker compose exec app sh

# Run development server
pnpm run dev

# Run tests
pnpm run test

# Run linter
pnpm run lint

# Build for production
pnpm run build

# Generate a component
pnpm run generate:component ComponentName
```

### Wireframe Viewer

```bash
cd docs/design/wireframes

# Start viewer (hot-reload)
npm run dev

# Validate all SVGs
npm run validate
```

---

## Component Pattern

All components follow the mandatory 5-file structure:

```
src/components/Button/
├── index.tsx                    # Exports
├── Button.tsx                   # Implementation
├── Button.test.tsx              # Unit tests
├── Button.stories.tsx           # Storybook
└── Button.accessibility.test.tsx # A11y tests
```

Use the generator:

```bash
docker compose exec app pnpm run generate:component Button
```

---

## Understanding Feature Specs

Each feature has a PRP (Product Requirements Prompt) file:

```
features/foundation/000-rls-implementation/
├── 000_rls_implementation_feature.md   # Original spec (authored)
├── spec.md                              # Generated specification
├── plan.md                              # Implementation plan
├── tasks.md                             # Task breakdown
└── checklist.md                         # Verification checklist
```

### Feature File Sections

1. **Product Requirements** - What & why
2. **Context & Codebase Intelligence** - Existing patterns
3. **Technical Specifications** - Code snippets
4. **Implementation Runbook** - Step-by-step
5. **Validation Loops** - Pre/during/post checks
6. **Risk Mitigation** - Potential issues
7. **References** - Links & resources

---

## Constitution Principles

All code must follow these 6 principles:

| #   | Principle                | Enforcement                   |
| --- | ------------------------ | ----------------------------- |
| 1   | 5-file component pattern | CI validation                 |
| 2   | Test-first development   | Pre-push hooks                |
| 3   | SpecKit workflow         | No skipped steps              |
| 4   | Docker-first             | No local installs             |
| 5   | Progressive enhancement  | PWA, a11y, mobile-first       |
| 6   | Privacy first            | GDPR, consent before tracking |

See `.specify/memory/constitution.md` for full details.

---

## Troubleshooting

### Docker Issues

**Container won't start**

```bash
# Check logs
docker compose logs app

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

**Port already in use**

```bash
# Find process using port 3000
lsof -i :3000

# Kill it or change port in docker-compose.yml
```

### Permission Issues

**Can't write files in container**

```bash
# Check ownership
ls -la src/

# Fix permissions (Linux/Mac)
sudo chown -R $USER:$USER .
```

### Wireframe Viewer Issues

**Viewer won't start**

```bash
cd docs/design/wireframes
rm -rf node_modules
npm install
npm run dev
```

---

## Next Steps

1. **Browse feature specs** - Start with `features/IMPLEMENTATION_ORDER.md`
2. **View wireframes** - Run the viewer at `docs/design/wireframes`
3. **Read the constitution** - Understand the 6 principles
4. **Pick a feature** - Begin with Tier 1 (Foundation) features
5. **Start the workflow** - Run `/speckit.specify` on your chosen feature

---

## Getting Help

| Need              | Resource                          |
| ----------------- | --------------------------------- |
| Contributing      | See `CONTRIBUTING.md`             |
| Architecture      | See `docs/architecture/README.md` |
| Feature questions | Open a Discussion                 |
| Bug reports       | Open an Issue                     |
| Security issues   | Email security@example.com        |

---

## Quick Reference Card

```
# Start development
docker compose up -d
docker compose exec app sh

# Feature workflow
/speckit.specify → /speckit.clarify → /wireframe →
/speckit.plan → /speckit.tasks → /speckit.implement

# Run tests
pnpm run test

# Generate component
pnpm run generate:component Name

# View wireframes
cd docs/design/wireframes && npm run dev
```

# Product Requirements Prompt (PRP)

**Feature Name**: Visual Regression Testing  
**Priority**: P0 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A visual regression testing system using Chromatic or Percy that automatically captures and compares UI screenshots across builds to detect unintended visual changes. This will integrate with the existing Storybook setup and GitHub Actions CI/CD pipeline.

### Why We're Building It

- Constitutional requirement (Section 4: Visual Testing - Chromatic/Percy)
- Currently marked as "❌ Sprint 3 Priority" in constitution
- 32 themes require visual validation
- Prevents UI regressions across theme switches
- Ensures consistent component rendering

### Success Criteria

- [ ] Visual tests run on every PR
- [ ] All 32 themes are tested
- [ ] Component stories have visual snapshots
- [ ] Diff review integrated in PR workflow
- [ ] Baseline updates are tracked
- [ ] CI pipeline includes visual checks
- [ ] < 5% false positive rate

### Out of Scope

- Cross-browser visual testing (Chrome only for now)
- Mobile device testing (desktop viewport only)
- Performance impact testing
- Interaction testing (static snapshots only)

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Storybook Configuration

```javascript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y'
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {}
  }
};
```

#### GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test
```

#### Theme System

```typescript
// 32 themes configured in tailwind.config.ts
daisyui: {
  themes: [
    'light',
    'dark',
    'cupcake',
    'bumblebee',
    'emerald',
    'corporate',
    'synthwave',
    'retro',
    'cyberpunk',
    'valentine',
    'halloween',
    'garden',
    'forest',
    'aqua',
    'lofi',
    'pastel',
    'fantasy',
    'wireframe',
    'black',
    'luxury',
    'dracula',
    'cmyk',
    'autumn',
    'business',
    'acid',
    'lemonade',
    'night',
    'coffee',
    'winter',
    'sunset',
    'dim',
    'nord',
  ];
}
```

### Dependencies & Libraries

#### Option 1: Chromatic (Recommended)

```bash
pnpm add -D chromatic
```

- Free for open source (5000 snapshots/month)
- Built by Storybook team
- Automatic PR comments
- No additional config needed

#### Option 2: Percy

```bash
pnpm add -D @percy/cli @percy/storybook
```

- More mature platform
- Better enterprise features
- Requires Percy token

### File Structure

```
.github/
├── workflows/
│   ├── ci.yml              # UPDATE: Add visual tests
│   └── chromatic.yml       # NEW: Dedicated visual testing
src/
├── components/
│   └── */
│       └── *.stories.tsx   # UPDATE: Add visual test stories
.storybook/
├── main.ts                 # Existing config
└── preview.tsx             # UPDATE: Add theme decorators
```

---

## 3. Technical Specifications

### Chromatic Integration

```yaml
# .github/workflows/chromatic.yml
name: Visual Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: corepack enable
      - run: pnpm install

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Run Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          buildScriptName: build-storybook
          onlyChanged: true
          exitOnceUploaded: true
```

### Theme Testing Strategy

```typescript
// .storybook/preview.tsx
import { withThemeByDataAttribute } from '@storybook/addon-themes';

const themes = [
  'light',
  'dark',
  'cupcake', // ... all 32 themes
];

export const decorators = [
  withThemeByDataAttribute({
    themes: Object.fromEntries(themes.map((theme) => [theme, theme])),
    defaultTheme: 'light',
    attributeName: 'data-theme',
  }),
];

// Generate stories for each theme
export const parameters = {
  chromatic: {
    modes: {
      light: { theme: 'light' },
      dark: { theme: 'dark' },
      // Test subset of themes to manage snapshot count
      synthwave: { theme: 'synthwave' },
      cyberpunk: { theme: 'cyberpunk' },
    },
  },
};
```

### Component Story Pattern

```typescript
// Example: Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    chromatic: {
      // Capture at multiple viewports
      viewports: [320, 768, 1200],
      // Test with all variants
      delay: 300, // Wait for animations
      diffThreshold: 0.2 // Acceptable diff percentage
    }
  }
};

export default meta;

// Visual test stories
export const AllVariants: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="accent">Accent</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  )
};
```

### Performance Requirements

- Build time: < 5 minutes
- Snapshot comparison: < 30 seconds per component
- Storage: ~100MB for baseline images
- Monthly quota: 5000 snapshots (free tier)

---

## 4. Implementation Runbook

### Step 1: Setup Chromatic

```bash
# Install Chromatic
pnpm add -D chromatic

# Login and link project
pnpm dlx chromatic --project-token=<token>

# Add token to GitHub secrets
# Settings → Secrets → Actions → New repository secret
# Name: CHROMATIC_PROJECT_TOKEN
```

### Step 2: Configure Storybook

1. Update `.storybook/preview.tsx` with theme modes
2. Add viewport configurations
3. Set diff thresholds per component
4. Configure delay for animations

### Step 3: Create GitHub Workflow

```bash
# Create workflow file
mkdir -p .github/workflows
touch .github/workflows/chromatic.yml

# Add workflow configuration (see Technical Specs)
```

### Step 4: Update Existing Stories

- Add visual test variants to each component story
- Group related states for efficient snapshots
- Add responsive viewport tests for key components
- Document expected visual behavior

### Step 5: Establish Baselines

```bash
# Run initial Chromatic build
pnpm dlx chromatic --project-token=<token> --auto-accept-changes

# This creates the baseline snapshots
```

### Step 6: Testing

- [ ] Create test PR with visual changes
- [ ] Verify Chromatic comments on PR
- [ ] Test approval workflow
- [ ] Verify baseline updates
- [ ] Check theme switching detection

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] Storybook configured and running
- [x] GitHub Actions CI working
- [x] All components have stories
- [ ] Chromatic account created

### During Implementation

- [ ] Snapshots capture correctly
- [ ] PR integration works
- [ ] Theme variants detected
- [ ] False positive rate acceptable

### Post-Implementation

- [ ] All components have visual tests
- [ ] CI pipeline includes visual checks
- [ ] Team trained on approval process
- [ ] Documentation complete

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Snapshot count exceeds free tier
   **Mitigation**: Test subset of themes, use story composition

2. **Risk**: False positives from animations
   **Mitigation**: Add delays, disable animations in tests

3. **Risk**: Slow CI pipeline
   **Mitigation**: Parallel execution, only test changed components

4. **Risk**: Large repository size from baselines
   **Mitigation**: Store baselines in Chromatic cloud, not git

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 4: Testing Strategy)
- Storybook Config: `/.storybook/main.ts`
- CI Pipeline: `/.github/workflows/ci.yml`
- Theme Config: `/tailwind.config.ts`

### External Resources

- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Chromatic + GitHub Actions](https://www.chromatic.com/docs/github-actions/)
- [Percy Documentation](https://docs.percy.io/)
- [Storybook Visual Testing](https://storybook.js.org/docs/react/writing-tests/visual-testing)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox → Processed)

- [ ] Specification generated
- [ ] Plan created
- [ ] Tasks broken down
- [ ] Implementation started
- [ ] Completed on: [PENDING]

---

<!--
PRP for Visual Regression Testing
Generated from SpecKit constitution analysis
Ensures UI consistency across 32 themes
-->

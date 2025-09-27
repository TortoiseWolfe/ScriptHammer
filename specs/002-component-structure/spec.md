# Product Requirements Prompt (PRP)

**Feature Name**: Component Structure Standardization  
**Priority**: P0 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A standardization initiative to ensure all components follow the constitutional 4-file pattern. This includes an audit tool, automated scaffolding, and migration of existing components to the proper structure.

### Why We're Building It

- Constitutional requirement (Section 4: Component Structure - 4 files per component)
- Currently marked as "⚠️ 2-3 files" - needs fixing
- Ensures consistency across the codebase
- Improves developer experience
- Enables better tooling and automation

### Success Criteria

- [ ] All components follow 4-file pattern
- [ ] Audit script identifies non-compliant components
- [ ] Scaffolding tool generates proper structure
- [ ] Migration completed for existing components
- [ ] CI validation enforces structure
- [ ] Documentation updated
- [ ] VSCode snippets created
- [ ] 100% compliance achieved

### Out of Scope

- Changing component functionality
- Refactoring component logic
- Adding new features to components
- Changing atomic design hierarchy

---

## 2. Context & Codebase Intelligence

### Required 4-File Pattern

```
ComponentName/
├── index.tsx           # Barrel export
├── ComponentName.tsx   # Main component
├── ComponentName.test.tsx  # Tests
└── ComponentName.stories.tsx  # Storybook
```

### Current State Analysis

```typescript
// Many components missing test or story files
// Example current structure:
Button/
├── Button.tsx          ✅
├── Button.stories.tsx  ✅
└── (missing Button.test.tsx and index.tsx)
```

### Barrel Export Pattern

```typescript
// index.tsx
export { default } from './ComponentName';
export type { ComponentNameProps } from './ComponentName';
```

### Test File Template

```typescript
// ComponentName.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ComponentName from './ComponentName';

describe('ComponentName', () => {
  it('renders without crashing', () => {
    render(<ComponentName />);
    // Add assertions
  });
});
```

### Dependencies & Libraries

```bash
# No new dependencies needed
# Using existing:
# - vitest for tests
# - @storybook/react for stories
# - plop for scaffolding (to be added)
pnpm add -D plop
```

### File Structure

```
scripts/
├── audit-components.js    # Audit script
├── migrate-components.js  # Migration script
└── validate-structure.js  # CI validation

plopfile.js               # Component generator
plop-templates/
└── component/
    ├── index.tsx.hbs
    ├── Component.tsx.hbs
    ├── Component.test.tsx.hbs
    └── Component.stories.tsx.hbs
```

---

## 3. Technical Specifications

### Audit Script

```javascript
// scripts/audit-components.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const REQUIRED_FILES = [
  'index.tsx',
  '{name}.tsx',
  '{name}.test.tsx',
  '{name}.stories.tsx',
];

function auditComponents() {
  const componentDirs = glob.sync('src/components/**/', {
    ignore: ['**/node_modules/**'],
  });

  const report = {
    compliant: [],
    nonCompliant: [],
    details: {},
  };

  componentDirs.forEach((dir) => {
    // Skip non-component directories
    if (dir.includes('/__') || dir.endsWith('/components/')) return;

    const componentName = path.basename(dir);
    const files = fs.readdirSync(dir);
    const missing = [];

    // Check for required files
    const hasIndex = files.includes('index.tsx');
    const hasComponent = files.includes(`${componentName}.tsx`);
    const hasTest = files.includes(`${componentName}.test.tsx`);
    const hasStory = files.includes(`${componentName}.stories.tsx`);

    if (!hasIndex) missing.push('index.tsx');
    if (!hasComponent) missing.push(`${componentName}.tsx`);
    if (!hasTest) missing.push(`${componentName}.test.tsx`);
    if (!hasStory) missing.push(`${componentName}.stories.tsx`);

    if (missing.length === 0) {
      report.compliant.push(componentName);
    } else {
      report.nonCompliant.push(componentName);
      report.details[componentName] = {
        path: dir,
        missing,
        existing: files,
      };
    }
  });

  // Generate report
  console.log('\n📊 Component Structure Audit Report\n');
  console.log('='.repeat(50));
  console.log(`✅ Compliant: ${report.compliant.length} components`);
  console.log(`❌ Non-compliant: ${report.nonCompliant.length} components`);
  console.log(
    `📈 Compliance Rate: ${Math.round((report.compliant.length / (report.compliant.length + report.nonCompliant.length)) * 100)}%`
  );

  if (report.nonCompliant.length > 0) {
    console.log('\n⚠️  Non-compliant Components:\n');
    report.nonCompliant.forEach((name) => {
      console.log(`\n  ${name}:`);
      console.log(`    Path: ${report.details[name].path}`);
      console.log(`    Missing: ${report.details[name].missing.join(', ')}`);
    });
  }

  // Save report to file
  fs.writeFileSync(
    'component-audit-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 Full report saved to component-audit-report.json\n');

  return report;
}

module.exports = auditComponents;

if (require.main === module) {
  auditComponents();
}
```

### Migration Script

```javascript
// scripts/migrate-components.js
const fs = require('fs');
const path = require('path');
const audit = require('./audit-components');

function generateIndexFile(componentName) {
  return `export { default } from './${componentName}';
export type { ${componentName}Props } from './${componentName}';
`;
}

function generateTestFile(componentName) {
  return `import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  it('renders without crashing', () => {
    render(<${componentName} />);
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });
  
  // TODO: Add more specific tests
});
`;
}

function generateStoryFile(componentName, category) {
  return `import type { Meta, StoryObj } from '@storybook/react';
import ${componentName} from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${category}/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
`;
}

function migrateComponents() {
  const report = audit();
  let migrated = 0;

  console.log('\n🔄 Starting Component Migration\n');

  report.nonCompliant.forEach((componentName) => {
    const details = report.details[componentName];
    const componentPath = details.path;

    console.log(`\n  Migrating ${componentName}...`);

    details.missing.forEach((file) => {
      const filePath = path.join(componentPath, file);

      if (file === 'index.tsx') {
        fs.writeFileSync(filePath, generateIndexFile(componentName));
        console.log(`    ✅ Created ${file}`);
      } else if (file.endsWith('.test.tsx')) {
        fs.writeFileSync(filePath, generateTestFile(componentName));
        console.log(`    ✅ Created ${file}`);
      } else if (file.endsWith('.stories.tsx')) {
        // Determine category from path
        const category = componentPath.includes('subatomic')
          ? 'Subatomic'
          : componentPath.includes('atomic')
            ? 'Atomic'
            : componentPath.includes('molecular')
              ? 'Molecular'
              : 'Other';
        fs.writeFileSync(filePath, generateStoryFile(componentName, category));
        console.log(`    ✅ Created ${file}`);
      }
    });

    migrated++;
  });

  console.log(`\n✅ Migration complete! ${migrated} components updated.\n`);
}

module.exports = migrateComponents;

if (require.main === module) {
  migrateComponents();
}
```

### Plop Generator Configuration

```javascript
// plopfile.js
module.exports = function (plop) {
  plop.setGenerator('component', {
    description: 'Create a new component with 4-file structure',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Component name:',
      },
      {
        type: 'list',
        name: 'category',
        message: 'Component category:',
        choices: ['subatomic', 'atomic', 'molecular', 'organisms', 'templates'],
      },
      {
        type: 'confirm',
        name: 'hasProps',
        message: 'Will this component have props?',
        default: true,
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/components/{{category}}/{{pascalCase name}}/index.tsx',
        templateFile: 'plop-templates/component/index.tsx.hbs',
      },
      {
        type: 'add',
        path: 'src/components/{{category}}/{{pascalCase name}}/{{pascalCase name}}.tsx',
        templateFile: 'plop-templates/component/Component.tsx.hbs',
      },
      {
        type: 'add',
        path: 'src/components/{{category}}/{{pascalCase name}}/{{pascalCase name}}.test.tsx',
        templateFile: 'plop-templates/component/Component.test.tsx.hbs',
      },
      {
        type: 'add',
        path: 'src/components/{{category}}/{{pascalCase name}}/{{pascalCase name}}.stories.tsx',
        templateFile: 'plop-templates/component/Component.stories.tsx.hbs',
      },
    ],
  });
};
```

### CI Validation Script

```javascript
// scripts/validate-structure.js
const audit = require('./audit-components');

function validateStructure() {
  const report = audit();

  if (report.nonCompliant.length > 0) {
    console.error('\n❌ Component structure validation failed!\n');
    console.error('The following components do not follow the 4-file pattern:');
    report.nonCompliant.forEach((name) => {
      console.error(`  - ${name}`);
    });
    console.error('\nRun "npm run migrate:components" to fix.\n');
    process.exit(1);
  }

  console.log('\n✅ All components follow the 4-file pattern!\n');
  process.exit(0);
}

if (require.main === module) {
  validateStructure();
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "audit:components": "node scripts/audit-components.js",
    "migrate:components": "node scripts/migrate-components.js",
    "validate:structure": "node scripts/validate-structure.js",
    "generate:component": "plop component",
    "precommit": "npm run validate:structure"
  }
}
```

### VSCode Snippets

```json
// .vscode/component.code-snippets
{
  "React Component with 4-File Structure": {
    "prefix": "rfc4",
    "body": [
      "// ${1:ComponentName}.tsx",
      "import React from 'react';",
      "",
      "export interface ${1:ComponentName}Props {",
      "  children?: React.ReactNode;",
      "}",
      "",
      "export default function ${1:ComponentName}({ children }: ${1:ComponentName}Props) {",
      "  return (",
      "    <div>",
      "      {children}",
      "    </div>",
      "  );",
      "}"
    ]
  }
}
```

---

## 4. Implementation Runbook

### Step 1: Install Tooling

```bash
pnpm add -D plop glob
```

### Step 2: Create Scripts

```bash
mkdir -p scripts
touch scripts/audit-components.js
touch scripts/migrate-components.js
touch scripts/validate-structure.js
```

### Step 3: Run Initial Audit

```bash
node scripts/audit-components.js
```

### Step 4: Create Plop Templates

```bash
mkdir -p plop-templates/component
# Create template files
```

### Step 5: Run Migration

```bash
node scripts/migrate-components.js
```

### Step 6: Verify Compliance

```bash
node scripts/validate-structure.js
```

### Step 7: Add to CI

```yaml
# .github/workflows/ci.yml
- name: Validate Component Structure
  run: npm run validate:structure
```

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] Current structure analyzed
- [x] 4-file pattern defined
- [x] Migration strategy clear
- [x] Tooling identified

### During Implementation

- [ ] Audit script working
- [ ] Migration successful
- [ ] No functionality broken
- [ ] Tests still passing

### Post-Implementation

- [ ] 100% compliance achieved
- [ ] CI validation active
- [ ] Documentation updated
- [ ] Team trained on new structure

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Breaking existing imports
   **Mitigation**: Barrel exports maintain compatibility

2. **Risk**: Large number of new test files
   **Mitigation**: Start with minimal smoke tests

3. **Risk**: Merge conflicts during migration
   **Mitigation**: Coordinate with team, migrate in batches

4. **Risk**: CI failures from structure validation
   **Mitigation**: Grace period before enforcing

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 4: Component Structure)
- Component Examples: `/src/components/`
- Testing Guide: `/TESTING.md`
- Storybook Config: `/.storybook/`

### External Resources

- [Atomic Design Methodology](https://bradfrost.com/blog/post/atomic-web-design/)
- [Barrel Exports Best Practices](https://basarat.gitbook.io/typescript/main-1/barrel)
- [Plop.js Documentation](https://plopjs.com/)
- [Component Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

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
PRP for Component Structure Standardization
Generated from SpecKit constitution analysis
Ensures all components follow 4-file pattern
-->

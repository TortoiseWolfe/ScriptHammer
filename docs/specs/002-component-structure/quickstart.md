# Quick Start: Component Structure Standardization

## Prerequisites

- Node.js 16+ installed
- React/Next.js project with components
- Write access to src/components directory
- pnpm package manager

## Installation

```bash
# Install dependencies
pnpm add -D plop glob

# Create scripts directory
mkdir -p scripts

# Copy the audit, migrate, and validate scripts
cp specs/002-component-structure/scripts/* scripts/

# Add pnpm scripts to package.json
pnpm pkg set scripts.audit:components="node scripts/audit-components.js"
pnpm pkg set scripts.migrate:components="node scripts/migrate-components.js"
pnpm pkg set scripts.validate:structure="node scripts/validate-structure.js"
pnpm pkg set scripts.generate:component="plop component"
```

## Basic Usage

### 1. Check Current Compliance

```bash
# Run audit to see current state
ppnpm run audit:components

# Example output:
# 📊 Component Structure Audit Report
# ==================================================
# ✅ Compliant: 12 components
# ❌ Non-compliant: 38 components
# 📈 Compliance Rate: 24%
#
# ⚠️  Non-compliant Components:
#
#   Button:
#     Path: src/components/atomic/Button/
#     Missing: index.tsx, Button.test.tsx
#
#   Card:
#     Path: src/components/atomic/Card/
#     Missing: index.tsx, Card.test.tsx
```

### 2. Auto-Migrate Components

```bash
# Dry run to preview changes
ppnpm run migrate:components -- --dry-run

# Perform actual migration
ppnpm run migrate:components

# Example output:
# 🔄 Starting Component Migration
#
#   Migrating Button...
#     ✅ Created index.tsx
#     ✅ Created Button.test.tsx
#
#   Migrating Card...
#     ✅ Created index.tsx
#     ✅ Created Card.test.tsx
#
# ✅ Migration complete! 38 components updated.
```

### 3. Validate in CI

```bash
# Add to CI pipeline
pnpm run validate:structure

# Exit code 0 if compliant, 1 if not
```

### 4. Generate New Components

```bash
# Interactive component generator
pnpm run generate:component

# Prompts:
# ? Component name: UserAvatar
# ? Component category: atomic
# ? Will this component have props? Yes

# Creates:
# src/components/atomic/UserAvatar/
# ├── index.tsx
# ├── UserAvatar.tsx
# ├── UserAvatar.test.tsx
# └── UserAvatar.stories.tsx
```

## Quick Test

### Step-by-Step Validation

1. **Create test component manually:**

```bash
mkdir -p src/components/test/TestComponent
echo "export default function TestComponent() { return <div>Test</div>; }" > src/components/test/TestComponent/TestComponent.tsx
```

2. **Run audit to see it's non-compliant:**

```bash
pnpm run audit:components | grep TestComponent
# Output: Missing: index.tsx, TestComponent.test.tsx, TestComponent.stories.tsx
```

3. **Migrate to fix:**

```bash
pnpm run migrate:components -- --component TestComponent
```

4. **Verify compliance:**

```bash
pnpm run audit:components | grep TestComponent
# Should now show as compliant
```

5. **Check generated files:**

```bash
ls -la src/components/test/TestComponent/
# Should show all 4 files
```

## Advanced Usage

### JSON Output for Automation

```bash
# Get JSON report for parsing
pnpm run audit:components -- --format json > audit.json

# Extract compliance rate
cat audit.json | jq '.summary.complianceRate'
```

### Migrate Specific Components

```bash
# Only migrate specific components
pnpm run migrate:components -- --components Button,Card,Modal
```

### Custom Categories

```bash
# Add new category in plopfile.js
plop component --category custom
```

### CI Integration

```yaml
# .github/workflows/ci.yml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: pnpm install --frozen-lockfile
      - run: pnpm run validate:structure
```

## Verification Steps

### Manual Verification

1. **Count compliant components:**

```bash
pnpm run audit:components -- --format json | jq '.summary.compliant'
```

2. **List non-compliant:**

```bash
pnpm run audit:components -- --format json | jq '.nonCompliant[].component'
```

3. **Check specific component:**

```bash
ls -la src/components/atomic/Button/
# Should see: index.tsx, Button.tsx, Button.test.tsx, Button.stories.tsx
```

### Automated Verification

```javascript
// test-compliance.js
const audit = require('./scripts/audit-components');

async function verify() {
  const report = await audit();

  console.assert(
    report.summary.complianceRate === 100,
    'Not all components compliant'
  );

  console.assert(
    report.nonCompliant.length === 0,
    'Found non-compliant components'
  );

  console.log('✅ All components follow 4-file structure');
}

verify();
```

## Troubleshooting

### Common Issues

**Issue**: Migration fails with "EACCES: permission denied"

```bash
# Fix: Ensure write permissions
chmod -R u+w src/components
```

**Issue**: Component not detected

```bash
# Check naming convention (must be PascalCase)
# Check location (must be in src/components/**)
```

**Issue**: Test files created but tests fail

```bash
# The generated tests are minimal stubs
# Update them with actual test logic
```

**Issue**: Imports broken after migration

```bash
# Barrel exports maintain compatibility
# Check that index.tsx exports are correct
```

## Success Criteria Checklist

- [ ] Run `pnpm run audit:components` - shows report
- [ ] Run `pnpm run migrate:components` - creates missing files
- [ ] Run `pnpm run validate:structure` - exits with 0
- [ ] All components have 4 files
- [ ] CI pipeline includes validation
- [ ] Team can generate new components with proper structure
- [ ] No broken imports after migration
- [ ] Tests still pass after migration

## Next Steps

1. **Customize templates** in plop-templates/ for your patterns
2. **Add component-specific tests** to replace stubs
3. **Configure VSCode snippets** for faster development
4. **Set up pre-commit hooks** to maintain compliance
5. **Document team conventions** in component guide

## Quick Reference

| Command                       | Purpose          |
| ----------------------------- | ---------------- |
| `pnpm run audit:components`   | Check compliance |
| `pnpm run migrate:components` | Fix structure    |
| `pnpm run validate:structure` | CI validation    |
| `pnpm run generate:component` | New component    |

## Support

For issues or questions:

1. Check component-audit-report.json for details
2. Review migration.log for errors
3. Run with --verbose for more information
4. Consult team lead for exceptions to 4-file rule

/**
 * Integration test for full migration workflow
 * Tests the complete migration process end-to-end
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// These will fail initially - modules don't exist yet
let auditComponents, migrateComponents, validateStructure;
try {
  auditComponents = require('../../audit-components');
  migrateComponents = require('../../migrate-components');
  validateStructure = require('../../validate-structure');
} catch (e) {
  // Expected to fail in TDD
}

describe('migration workflow integration', () => {
  const testProjectDir = path.join(__dirname, '../fixtures/migration-project');

  beforeEach(() => {
    // Create project with multiple non-compliant components
    fs.mkdirSync(testProjectDir, { recursive: true });
    const componentsDir = path.join(testProjectDir, 'src/components');

    // Component with missing index
    const comp1Dir = path.join(componentsDir, 'atomic/ComponentOne');
    fs.mkdirSync(comp1Dir, { recursive: true });
    fs.writeFileSync(
      path.join(comp1Dir, 'ComponentOne.tsx'),
      'export default function ComponentOne() {}'
    );
    fs.writeFileSync(
      path.join(comp1Dir, 'ComponentOne.test.tsx'),
      'test("renders", () => {});'
    );
    fs.writeFileSync(
      path.join(comp1Dir, 'ComponentOne.stories.tsx'),
      'export default { title: "ComponentOne" };'
    );

    // Component with missing test and story
    const comp2Dir = path.join(componentsDir, 'atomic/ComponentTwo');
    fs.mkdirSync(comp2Dir, { recursive: true });
    fs.writeFileSync(
      path.join(comp2Dir, 'index.tsx'),
      'export { default } from "./ComponentTwo";'
    );
    fs.writeFileSync(
      path.join(comp2Dir, 'ComponentTwo.tsx'),
      'export default function ComponentTwo() {}'
    );

    // Component with only main file
    const comp3Dir = path.join(componentsDir, 'molecular/ComponentThree');
    fs.mkdirSync(comp3Dir, { recursive: true });
    fs.writeFileSync(
      path.join(comp3Dir, 'ComponentThree.tsx'),
      'export default function ComponentThree() {}'
    );
  });

  afterEach(() => {
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  });

  it('should complete full migration workflow', () => {
    if (!auditComponents || !migrateComponents || !validateStructure) {
      assert.fail('Required modules not found');
    }

    const componentsPath = path.join(testProjectDir, 'src/components');

    // Step 1: Initial audit
    const auditBefore = auditComponents({ path: componentsPath });
    assert.strictEqual(
      auditBefore.summary.compliant,
      0,
      'Should have 0 compliant initially'
    );
    assert.strictEqual(
      auditBefore.summary.nonCompliant,
      3,
      'Should have 3 non-compliant initially'
    );

    // Step 2: Run migration
    const migrationResult = migrateComponents({
      path: componentsPath,
      backup: true,
    });
    assert.ok(migrationResult.success, 'Migration should succeed');
    assert.strictEqual(
      migrationResult.migrated,
      3,
      'Should migrate 3 components'
    );

    // Step 3: Audit after migration
    const auditAfter = auditComponents({ path: componentsPath });
    assert.strictEqual(
      auditAfter.summary.compliant,
      3,
      'Should have 3 compliant after migration'
    );
    assert.strictEqual(
      auditAfter.summary.nonCompliant,
      0,
      'Should have 0 non-compliant after migration'
    );

    // Step 4: Validate structure
    const validation = validateStructure({ path: componentsPath });
    assert.strictEqual(
      validation.valid,
      true,
      'Structure should be valid after migration'
    );
  });

  it('should create proper backup before migration', () => {
    if (!migrateComponents) {
      assert.fail('migrate-components module not found');
    }

    const componentsPath = path.join(testProjectDir, 'src/components');

    const result = migrateComponents({
      path: componentsPath,
      backup: true,
    });

    assert.ok(result.backupPath, 'Should return backup path');
    assert.ok(fs.existsSync(result.backupPath), 'Backup should exist');

    // Verify backup contains original files
    const backupComp1 = path.join(result.backupPath, 'atomic/ComponentOne');
    assert.ok(fs.existsSync(backupComp1), 'Backup should contain ComponentOne');
    assert.ok(
      !fs.existsSync(path.join(backupComp1, 'index.tsx')),
      'Backup should not have index.tsx that was missing'
    );
  });

  it('should handle dry-run mode correctly', () => {
    if (!migrateComponents) {
      assert.fail('migrate-components module not found');
    }

    const componentsPath = path.join(testProjectDir, 'src/components');

    // Run in dry-run mode
    const dryRunResult = migrateComponents({
      path: componentsPath,
      dryRun: true,
    });

    assert.ok(dryRunResult.planned, 'Should have planned actions');
    assert.strictEqual(
      dryRunResult.planned.length,
      3,
      'Should plan 3 migrations'
    );

    // Verify no actual changes were made
    const comp1Index = path.join(
      componentsPath,
      'atomic/ComponentOne/index.tsx'
    );
    assert.ok(!fs.existsSync(comp1Index), 'Should not create files in dry-run');
  });

  it('should handle partial migration failures', () => {
    if (!migrateComponents) {
      assert.fail('migrate-components module not found');
    }

    const componentsPath = path.join(testProjectDir, 'src/components');

    // Make one component read-only to simulate failure
    const comp2Dir = path.join(componentsPath, 'atomic/ComponentTwo');
    fs.chmodSync(comp2Dir, 0o444);

    const result = migrateComponents({
      path: componentsPath,
      continueOnError: true,
    });

    // Should still migrate the other components
    assert.ok(result.migrated >= 2, 'Should migrate at least 2 components');
    assert.ok(result.failed >= 0, 'Should track failed migrations');

    // Restore permissions
    fs.chmodSync(comp2Dir, 0o755);
  });

  it('should generate migration report', () => {
    if (!migrateComponents) {
      assert.fail('migrate-components module not found');
    }

    const componentsPath = path.join(testProjectDir, 'src/components');
    const reportPath = path.join(testProjectDir, 'migration-report.json');

    migrateComponents({
      path: componentsPath,
      output: reportPath,
    });

    assert.ok(fs.existsSync(reportPath), 'Should create report file');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.ok(report.timestamp, 'Report should have timestamp');
    assert.ok(report.components, 'Report should list components');
    assert.ok(report.filesCreated, 'Report should list created files');
  });
});

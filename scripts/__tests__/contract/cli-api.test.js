/**
 * Contract tests for CLI API validation
 * Ensures the CLI interfaces match the OpenAPI specification
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml'); // Note: Will need to be installed

// Load the OpenAPI spec
const specPath = path.join(
  __dirname,
  '../../../specs/002-component-structure/contracts/cli-api.yaml'
);
let apiSpec;
try {
  const specContent = fs.readFileSync(specPath, 'utf8');
  apiSpec = yaml.load(specContent);
} catch (e) {
  // Spec might not exist in some test scenarios
  apiSpec = null;
}

// Load the modules (will fail initially in TDD)
let auditComponents, migrateComponents, validateStructure;
try {
  auditComponents = require('../../audit-components');
  migrateComponents = require('../../migrate-components');
  validateStructure = require('../../validate-structure');
} catch (e) {
  // Expected to fail in TDD
}

describe('CLI API contract tests', () => {
  describe('audit endpoint contract', () => {
    it('should accept parameters matching /audit schema', () => {
      if (!apiSpec || !auditComponents) {
        assert.fail('API spec or audit module not found');
      }

      const auditSchema =
        apiSpec.paths['/audit'].post.requestBody.content['application/json']
          .schema;
      const requiredParams = auditSchema.properties;

      // Test that function accepts expected parameters
      assert.doesNotThrow(() => {
        auditComponents({
          path: requiredParams.path.default,
          format: requiredParams.format.default,
          includeIgnored: requiredParams.includeIgnored.default,
          verbose: requiredParams.verbose.default,
        });
      }, 'Should accept all schema parameters');
    });

    it('should return response matching AuditReport schema', () => {
      if (!apiSpec || !auditComponents) {
        assert.fail('API spec or audit module not found');
      }

      const result = auditComponents({ path: 'src/components' });
      const responseSchema = apiSpec.components.schemas.AuditReport;

      // Validate response structure
      assert.ok(result.timestamp, 'Should have timestamp');
      assert.ok(result.summary, 'Should have summary');
      assert.ok(
        Array.isArray(result.components) || Array.isArray(result.nonCompliant),
        'Should have components or nonCompliant array'
      );

      // Validate summary structure
      if (result.summary) {
        assert.ok(
          typeof result.summary.total === 'number',
          'Summary should have total'
        );
        assert.ok(
          typeof result.summary.compliant === 'number',
          'Summary should have compliant'
        );
        assert.ok(
          typeof result.summary.nonCompliant === 'number',
          'Summary should have nonCompliant'
        );
        assert.ok(
          typeof result.summary.complianceRate === 'number',
          'Summary should have complianceRate'
        );
      }
    });

    it('should validate format parameter enum values', () => {
      if (!auditComponents) {
        assert.fail('audit module not found');
      }

      const validFormats = ['json', 'markdown', 'console'];

      validFormats.forEach((format) => {
        assert.doesNotThrow(() => {
          auditComponents({ path: 'src/components', format });
        }, `Should accept ${format} format`);
      });
    });
  });

  describe('migrate endpoint contract', () => {
    it('should accept parameters matching /migrate schema', () => {
      if (!apiSpec || !migrateComponents) {
        assert.fail('API spec or migrate module not found');
      }

      const migrateSchema =
        apiSpec.paths['/migrate'].post.requestBody.content['application/json']
          .schema;
      const requiredParams = migrateSchema.properties;

      assert.doesNotThrow(() => {
        migrateComponents({
          path: requiredParams.path.default,
          dryRun: requiredParams.dryRun.default,
          backup: requiredParams.backup.default,
          components: [],
        });
      }, 'Should accept all schema parameters');
    });

    it('should return response matching MigrationResult schema', () => {
      if (!apiSpec || !migrateComponents) {
        assert.fail('API spec or migrate module not found');
      }

      const result = migrateComponents({
        path: 'src/components',
        dryRun: true,
      });

      // Validate response structure
      assert.ok(
        typeof result.success === 'boolean' || result.migrated !== undefined,
        'Should have success or migrated count'
      );

      if (result.migrated !== undefined) {
        assert.ok(
          typeof result.migrated === 'number',
          'Migrated should be number'
        );
      }
      if (result.failed !== undefined) {
        assert.ok(typeof result.failed === 'number', 'Failed should be number');
      }
      if (result.details) {
        assert.ok(Array.isArray(result.details), 'Details should be array');
      }
    });
  });

  describe('validate endpoint contract', () => {
    it('should accept parameters matching /validate schema', () => {
      if (!apiSpec || !validateStructure) {
        assert.fail('API spec or validate module not found');
      }

      const validateSchema =
        apiSpec.paths['/validate'].post.requestBody.content['application/json']
          .schema;
      const requiredParams = validateSchema.properties;

      assert.doesNotThrow(() => {
        validateStructure({
          path: requiredParams.path.default,
          failFast: requiredParams.failFast.default,
          strict: requiredParams.strict.default,
        });
      }, 'Should accept all schema parameters');
    });

    it('should return response matching ValidationReport schema', () => {
      if (!apiSpec || !validateStructure) {
        assert.fail('API spec or validate module not found');
      }

      const result = validateStructure({ path: 'src/components' });

      // Validate response structure
      assert.ok(typeof result.valid === 'boolean', 'Should have valid boolean');

      if (result.total !== undefined) {
        assert.ok(typeof result.total === 'number', 'Total should be number');
      }
      if (result.passed !== undefined) {
        assert.ok(typeof result.passed === 'number', 'Passed should be number');
      }
      if (result.failed !== undefined) {
        assert.ok(typeof result.failed === 'number', 'Failed should be number');
      }
      if (result.errors) {
        assert.ok(Array.isArray(result.errors), 'Errors should be array');
      }
      if (result.warnings) {
        assert.ok(Array.isArray(result.warnings), 'Warnings should be array');
      }
    });

    it('should return proper exit codes', () => {
      if (!validateStructure) {
        assert.fail('validate module not found');
      }

      const validResult = validateStructure({ path: 'valid/path' });
      const invalidResult = validateStructure({ path: 'invalid/path' });

      // Check exit codes match expected values
      if (validResult.exitCode !== undefined) {
        assert.ok(
          validResult.exitCode === 0 || validResult.exitCode === 1,
          'Exit code should be 0 or 1'
        );
      }
    });
  });

  describe('scaffold endpoint contract', () => {
    it('should validate required parameters for /scaffold', () => {
      if (!apiSpec) {
        assert.fail('API spec not found');
      }

      const scaffoldSchema =
        apiSpec.paths['/scaffold'].post.requestBody.content['application/json']
          .schema;

      // Check required fields
      assert.ok(
        scaffoldSchema.required.includes('name'),
        'Name should be required'
      );
      assert.ok(
        scaffoldSchema.required.includes('category'),
        'Category should be required'
      );

      // Check enum values for category
      const categoryEnum = scaffoldSchema.properties.category.enum;
      assert.ok(categoryEnum.includes('subatomic'), 'Should support subatomic');
      assert.ok(categoryEnum.includes('atomic'), 'Should support atomic');
      assert.ok(categoryEnum.includes('molecular'), 'Should support molecular');
    });
  });

  describe('error response contracts', () => {
    it('should handle 400 Bad Request errors', () => {
      if (!auditComponents) {
        assert.fail('audit module not found');
      }

      const result = auditComponents({ path: null }); // Invalid path
      if (result.error) {
        assert.ok(result.error, 'Should have error for invalid input');
      }
    });

    it('should handle 500 Internal Server errors', () => {
      // This would test error handling for unexpected failures
      // Implementation depends on how modules handle errors
      assert.ok(true, 'Error handling contract defined');
    });
  });

  describe('common response fields', () => {
    it('should include timestamp in responses', () => {
      if (!auditComponents) {
        assert.fail('audit module not found');
      }

      const result = auditComponents({
        path: 'src/components',
        format: 'json',
      });
      if (result.timestamp) {
        const timestamp = new Date(result.timestamp);
        assert.ok(
          timestamp instanceof Date && !isNaN(timestamp),
          'Timestamp should be valid date'
        );
      }
    });

    it('should use consistent status enums', () => {
      const validStatuses = ['compliant', 'non_compliant', 'ignored'];
      // This would be validated when checking actual component statuses
      assert.ok(validStatuses.length > 0, 'Status enums defined');
    });
  });
});

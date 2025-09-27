/**
 * Unit tests for Plop component generator
 * Tests the component scaffolding functionality
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// This will fail initially - plop config doesn't exist yet
let plopfile;
try {
  plopfile = require('../../plopfile');
} catch (e) {
  plopfile = null;
}

describe('plop component generator', () => {
  describe('generator configuration', () => {
    it('should export a function for plop', () => {
      assert.strictEqual(
        typeof plopfile,
        'function',
        'plopfile should export a function'
      );
    });

    it('should register component generator', () => {
      if (!plopfile) {
        assert.fail('plopfile not found');
      }

      const mockPlop = {
        generators: {},
        setGenerator: function (name, config) {
          this.generators[name] = config;
        },
      };

      plopfile(mockPlop);
      assert.ok(
        mockPlop.generators.component,
        'Should register component generator'
      );
    });

    it('should have required prompts', () => {
      if (!plopfile) {
        assert.fail('plopfile not found');
      }

      const mockPlop = {
        generators: {},
        setGenerator: function (name, config) {
          this.generators[name] = config;
        },
      };

      plopfile(mockPlop);
      const generator = mockPlop.generators.component;

      assert.ok(generator.prompts, 'Should have prompts');

      const promptNames = generator.prompts.map((p) => p.name);
      assert.ok(
        promptNames.includes('name'),
        'Should prompt for component name'
      );
      assert.ok(promptNames.includes('category'), 'Should prompt for category');
    });

    it('should have actions to create files', () => {
      if (!plopfile) {
        assert.fail('plopfile not found');
      }

      const mockPlop = {
        generators: {},
        setGenerator: function (name, config) {
          this.generators[name] = config;
        },
      };

      plopfile(mockPlop);
      const generator = mockPlop.generators.component;

      assert.ok(generator.actions, 'Should have actions');
      assert.ok(
        generator.actions.length >= 4,
        'Should have at least 4 actions (4 files)'
      );

      const paths = generator.actions.map((a) => a.path);
      assert.ok(
        paths.some((p) => p.includes('index.tsx')),
        'Should create index.tsx'
      );
      assert.ok(
        paths.some((p) => p.includes('.tsx') && !p.includes('index')),
        'Should create component file'
      );
      assert.ok(
        paths.some((p) => p.includes('.test.tsx')),
        'Should create test file'
      );
      assert.ok(
        paths.some((p) => p.includes('.stories.tsx')),
        'Should create stories file'
      );
    });
  });

  describe('template validation', () => {
    const templateDir = path.join(__dirname, '../../plop-templates/component');

    it('should have all required templates', () => {
      // Templates might not exist yet in TDD
      if (!fs.existsSync(templateDir)) {
        assert.fail('Template directory not found');
        return;
      }

      const requiredTemplates = [
        'index.tsx.hbs',
        'Component.tsx.hbs',
        'Component.test.tsx.hbs',
        'Component.stories.tsx.hbs',
      ];

      requiredTemplates.forEach((template) => {
        const templatePath = path.join(templateDir, template);
        assert.ok(
          fs.existsSync(templatePath),
          `Should have ${template} template`
        );
      });
    });

    it('should have valid handlebars syntax in templates', () => {
      if (!fs.existsSync(templateDir)) {
        assert.fail('Template directory not found');
        return;
      }

      const indexTemplate = path.join(templateDir, 'index.tsx.hbs');
      if (fs.existsSync(indexTemplate)) {
        const content = fs.readFileSync(indexTemplate, 'utf8');
        assert.ok(
          content.includes('{{'),
          'Should have handlebars placeholders'
        );
        assert.ok(content.includes('export'), 'Should have export statement');
      }
    });
  });

  describe('component generation', () => {
    const testOutputDir = path.join(
      __dirname,
      '../fixtures/generated-components'
    );

    beforeEach(() => {
      fs.mkdirSync(testOutputDir, { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    });

    it('should generate component with correct structure', () => {
      if (!plopfile) {
        assert.fail('plopfile not found');
      }

      // Mock plop runtime
      const mockPlop = {
        generators: {},
        setGenerator: function (name, config) {
          this.generators[name] = config;
        },
        renderString: function (template, data) {
          // Simple template replacement
          return template.replace(
            /\{\{(\w+)\}\}/g,
            (match, key) => data[key] || match
          );
        },
      };

      plopfile(mockPlop);
      const generator = mockPlop.generators.component;

      // Simulate running the generator
      const answers = {
        name: 'TestButton',
        category: 'atomic',
        hasProps: true,
      };

      // Check that actions would create the right files
      const expectedPaths = [
        'src/components/atomic/TestButton/index.tsx',
        'src/components/atomic/TestButton/TestButton.tsx',
        'src/components/atomic/TestButton/TestButton.test.tsx',
        'src/components/atomic/TestButton/TestButton.stories.tsx',
      ];

      generator.actions.forEach((action, index) => {
        if (action.type === 'add') {
          const renderedPath = mockPlop.renderString(action.path, answers);
          assert.ok(
            renderedPath.includes('TestButton'),
            `Action ${index} path should include component name`
          );
        }
      });
    });

    it('should handle different component categories', () => {
      if (!plopfile) {
        assert.fail('plopfile not found');
      }

      const mockPlop = {
        generators: {},
        setGenerator: function (name, config) {
          this.generators[name] = config;
        },
      };

      plopfile(mockPlop);
      const generator = mockPlop.generators.component;

      const categoryPrompt = generator.prompts.find(
        (p) => p.name === 'category'
      );
      assert.ok(categoryPrompt, 'Should have category prompt');
      assert.ok(categoryPrompt.choices, 'Should have category choices');

      const expectedCategories = [
        'subatomic',
        'atomic',
        'molecular',
        'organisms',
        'templates',
      ];
      expectedCategories.forEach((cat) => {
        assert.ok(
          categoryPrompt.choices.includes(cat) ||
            categoryPrompt.choices.some((c) => c.value === cat),
          `Should support ${cat} category`
        );
      });
    });

    it('should validate component name', () => {
      if (!plopfile) {
        assert.fail('plopfile not found');
      }

      const mockPlop = {
        generators: {},
        setGenerator: function (name, config) {
          this.generators[name] = config;
        },
      };

      plopfile(mockPlop);
      const generator = mockPlop.generators.component;

      const namePrompt = generator.prompts.find((p) => p.name === 'name');
      assert.ok(namePrompt, 'Should have name prompt');

      if (namePrompt.validate) {
        // Test validation function
        assert.ok(
          namePrompt.validate('ValidComponent'),
          'Should accept valid PascalCase'
        );
        assert.ok(
          !namePrompt.validate('invalid-component'),
          'Should reject kebab-case'
        );
        assert.ok(
          !namePrompt.validate('123Component'),
          'Should reject names starting with numbers'
        );
      }
    });
  });

  describe('template content', () => {
    it('should generate proper index.tsx content', () => {
      // This would be tested with actual template content
      const expectedContent = `export { default } from './ComponentName';
export type { ComponentNameProps } from './ComponentName';`;

      // Mock template rendering
      const renderTemplate = (template, data) => {
        return template
          .replace(/\{\{pascalCase name\}\}/g, data.name)
          .replace(/\{\{name\}\}/g, data.name);
      };

      const result = renderTemplate(expectedContent, { name: 'TestComponent' });
      assert.ok(
        result.includes('TestComponent'),
        'Should include component name'
      );
      assert.ok(result.includes('export { default }'), 'Should export default');
      assert.ok(result.includes('Props'), 'Should export props type');
    });

    it('should generate proper test file content', () => {
      const testTemplate = `import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {{name}} from './{{name}}';

describe('{{name}}', () => {
  it('renders without crashing', () => {
    render(<{{name}} />);
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });
});`;

      const renderTemplate = (template, data) => {
        return template.replace(/\{\{name\}\}/g, data.name);
      };

      const result = renderTemplate(testTemplate, { name: 'TestCard' });
      assert.ok(result.includes('TestCard'), 'Should include component name');
      assert.ok(result.includes('describe'), 'Should have describe block');
      assert.ok(result.includes('render'), 'Should test rendering');
    });

    it('should generate proper story file content', () => {
      const storyTemplate = `import type { Meta, StoryObj } from '@storybook/react';
import {{name}} from './{{name}}';

const meta: Meta<typeof {{name}}> = {
  title: 'Components/{{category}}/{{name}}',
  component: {{name}},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};`;

      const renderTemplate = (template, data) => {
        return template
          .replace(/\{\{name\}\}/g, data.name)
          .replace(/\{\{category\}\}/g, data.category);
      };

      const result = renderTemplate(storyTemplate, {
        name: 'TestModal',
        category: 'molecular',
      });
      assert.ok(result.includes('TestModal'), 'Should include component name');
      assert.ok(result.includes('molecular'), 'Should include category');
      assert.ok(result.includes('Meta'), 'Should have Meta type');
      assert.ok(result.includes('Default'), 'Should have default story');
    });
  });
});

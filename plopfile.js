/**
 * Plop Component Generator Configuration
 * Generates React components with the 5-file pattern (including accessibility tests)
 */

module.exports = function (plop) {
  // Component generator
  plop.setGenerator('component', {
    description: 'Create a new component with 5-file structure',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Component name (PascalCase):',
        validate: (value) => {
          // Validate PascalCase
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
            return 'Component name must be in PascalCase (e.g., ButtonComponent)';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'category',
        message: 'Component category:',
        choices: [
          { name: 'Subatomic (smallest building blocks)', value: 'subatomic' },
          { name: 'Atomic (basic UI elements)', value: 'atomic' },
          { name: 'Molecular (compound components)', value: 'molecular' },
          { name: 'Organisms (complex sections)', value: 'organisms' },
          { name: 'Templates (page layouts)', value: 'templates' },
        ],
        default: 'atomic',
      },
      {
        type: 'confirm',
        name: 'hasProps',
        message: 'Will this component have props?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'withHooks',
        message: 'Include custom hooks?',
        default: false,
      },
    ],
    actions: (data) => {
      const actions = [];
      const componentPath = 'src/components/{{category}}/{{pascalCase name}}';

      // Add index.tsx
      actions.push({
        type: 'add',
        path: `${componentPath}/index.tsx`,
        templateFile: 'tools/templates/component/index.tsx.hbs',
      });

      // Add Component.tsx
      actions.push({
        type: 'add',
        path: `${componentPath}/{{pascalCase name}}.tsx`,
        templateFile: 'tools/templates/component/Component.tsx.hbs',
      });

      // Add Component.test.tsx
      actions.push({
        type: 'add',
        path: `${componentPath}/{{pascalCase name}}.test.tsx`,
        templateFile: 'tools/templates/component/Component.test.tsx.hbs',
      });

      // Add Component.stories.tsx
      actions.push({
        type: 'add',
        path: `${componentPath}/{{pascalCase name}}.stories.tsx`,
        templateFile: 'tools/templates/component/Component.stories.tsx.hbs',
      });

      // Add Component.accessibility.test.tsx
      actions.push({
        type: 'add',
        path: `${componentPath}/{{pascalCase name}}.accessibility.test.tsx`,
        templateFile:
          'tools/templates/component/Component.accessibility.test.tsx.hbs',
      });

      // Add custom hook if requested
      if (data.withHooks) {
        actions.push({
          type: 'add',
          path: `${componentPath}/use{{pascalCase name}}.ts`,
          template: `import { useState, useEffect } from 'react';

/**
 * Custom hook for {{pascalCase name}} component
 */
export function use{{pascalCase name}}() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Hook logic here
  }, []);

  return { state };
}
`,
        });
      }

      return actions;
    },
  });

  // Helper to add custom Handlebars helpers
  plop.setHelper('upperCase', (text) => text.toUpperCase());
  plop.setHelper('properCase', (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  });
};

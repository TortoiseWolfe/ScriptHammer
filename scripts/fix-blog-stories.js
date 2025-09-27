#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixStoriesFile(filePath) {
  const componentName = path.basename(path.dirname(filePath));

  const content = `import type { Meta, StoryObj } from '@storybook/react';
import ${componentName} from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/Molecular/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '${componentName} component for the molecular category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
`;

  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
}

// Process all stories files
const componentsDir = path.join(process.cwd(), 'src/components/molecular');
const components = [
  'AuthorProfile',
  'BlogPostCard',
  'BlogPostViewer',
  'ConflictResolver',
  'SocialShareButtons',
];

components.forEach((component) => {
  const storiesFile = path.join(
    componentsDir,
    component,
    `${component}.stories.tsx`
  );
  if (fs.existsSync(storiesFile)) {
    fixStoriesFile(storiesFile);
  }
});

console.log('Stories files fixed!');

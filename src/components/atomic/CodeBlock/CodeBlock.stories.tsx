import type { Meta, StoryObj } from '@storybook/nextjs';
import { CodeBlock } from './CodeBlock';

const meta = {
  title: 'Atomic Design/Atomic/CodeBlock',
  component: CodeBlock,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    language: {
      control: 'text',
      description: 'Programming language for syntax highlighting',
    },
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: `function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome to the application, \${name}\`;
}

greet('World');`,
  },
};

export const JavaScript: Story = {
  args: {
    language: 'javascript',
    children: `// JavaScript example
const items = [1, 2, 3, 4, 5];

const doubled = items.map(x => x * 2);
console.log(doubled); // [2, 4, 6, 8, 10]

// Async function example
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json();
}`,
  },
};

export const TypeScript: Story = {
  args: {
    language: 'typescript',
    children: `// TypeScript example
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }
}`,
  },
};

export const BashScript: Story = {
  args: {
    language: 'bash',
    children: `#!/bin/bash

# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Deploy to server
scp -r dist/* user@server:/var/www/app/`,
  },
};

export const Python: Story = {
  args: {
    language: 'python',
    children: `# Python example
import asyncio

async def main():
    """Main async function"""
    print("Starting...")
    await asyncio.sleep(1)
    print("Done!")

if __name__ == "__main__":
    asyncio.run(main())`,
  },
};

export const JSON: Story = {
  args: {
    language: 'json',
    children: `{
  "name": "example-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "react": "^18.0.0",
    "next": "^14.0.0"
  }
}`,
  },
};

export const LongCode: Story = {
  args: {
    children: `// This is a very long line of code that should demonstrate horizontal scrolling behavior when the content exceeds the container width
const veryLongVariableName = "This is a string that is intentionally very long to test how the code block handles overflow and horizontal scrolling behavior in the component";

// Multiple lines of code
function complexFunction(param1, param2, param3, param4, param5) {
  const result1 = param1 + param2;
  const result2 = param3 * param4;
  const result3 = param5 / 2;

  return {
    sum: result1,
    product: result2,
    half: result3,
    combined: result1 + result2 + result3
  };
}

// Call the function
const output = complexFunction(10, 20, 30, 40, 50);
console.log(output);`,
  },
};

export const ShortCode: Story = {
  args: {
    children: `const x = 42;`,
  },
};

export const WithNestedElements: Story = {
  args: {
    children: (
      <code>
        <span className="text-blue-500">function</span>{' '}
        <span className="text-green-500">test</span>() {'{'}
        <br />
        {'  '}
        <span className="text-blue-500">return</span>{' '}
        <span className="text-orange-500">42</span>;
        <br />
        {'}'}
      </code>
    ),
  },
};

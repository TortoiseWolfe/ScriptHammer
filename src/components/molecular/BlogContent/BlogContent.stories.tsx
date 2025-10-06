import type { Meta, StoryObj } from '@storybook/nextjs';
import BlogContent from './BlogContent';

const meta: Meta<typeof BlogContent> = {
  title: 'Features/Blog/BlogContent',
  component: BlogContent,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'BlogContent component renders HTML content with syntax highlighting using Prism.js. It processes code blocks to add copy buttons and language labels.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    htmlContent: {
      control: 'text',
      description: 'HTML string content to render',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    htmlContent: `
      <h1>Blog Post Title</h1>
      <p>This is a sample blog post with some content. It demonstrates how the BlogContent component renders HTML content with proper styling.</p>
      <h2>Subtitle</h2>
      <p>More content here with <a href="#">a link</a> and some <code>inline code</code>.</p>
    `,
  },
};

export const WithCodeBlocks: Story = {
  args: {
    htmlContent: `
      <h1>Tutorial: Getting Started</h1>
      <p>Here's how to create a simple JavaScript function:</p>
      <pre><code class="language-javascript">function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome, \${name}\`;
}

// Call the function
greet('World');</code></pre>
      <p>And here's the TypeScript version:</p>
      <pre><code class="language-typescript">function greet(name: string): string {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome, \${name}\`;
}

// Call the function
greet('World');</code></pre>
    `,
  },
};

export const WithBashScript: Story = {
  args: {
    htmlContent: `
      <h1>Deployment Guide</h1>
      <p>Use this script to deploy your application:</p>
      <pre><code class="language-bash">#!/bin/bash

# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Deploy to server
scp -r dist/* user@server:/var/www/app/</code></pre>
      <p>Make sure to update the server details in the script.</p>
    `,
  },
};

export const WithLists: Story = {
  args: {
    htmlContent: `
      <h1>Features</h1>
      <p>Our application includes the following features:</p>
      <ul>
        <li>User authentication</li>
        <li>Real-time messaging</li>
        <li>File uploads</li>
        <li>Data visualization</li>
      </ul>
      <h2>Requirements</h2>
      <ol>
        <li>Node.js 18 or higher</li>
        <li>PostgreSQL database</li>
        <li>Redis for caching</li>
        <li>Docker for containerization</li>
      </ol>
    `,
  },
};

export const ComplexContent: Story = {
  args: {
    htmlContent: `
      <h1>Complete Guide to React Hooks</h1>
      <p>React Hooks revolutionized how we write React components. This guide covers the most important hooks you need to know.</p>

      <h2>useState Hook</h2>
      <p>The <code>useState</code> hook lets you add state to functional components:</p>
      <pre><code class="language-jsx">import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}</code></pre>

      <h2>useEffect Hook</h2>
      <p>The <code>useEffect</code> hook lets you perform side effects:</p>
      <pre><code class="language-jsx">import React, { useState, useEffect } from 'react';

function Timer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(seconds => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <div>Timer: {seconds}s</div>;
}</code></pre>

      <h3>Key Points</h3>
      <ul>
        <li>Always call hooks at the top level</li>
        <li>Never call hooks inside loops or conditions</li>
        <li>Use the dependency array in useEffect carefully</li>
        <li>Consider using useCallback and useMemo for optimization</li>
      </ul>

      <h2>Configuration Example</h2>
      <p>Here's a sample configuration file:</p>
      <pre><code class="language-json">{
  "name": "react-hooks-demo",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}</code></pre>
    `,
  },
};

export const MinimalContent: Story = {
  args: {
    htmlContent: `<p>Just a simple paragraph of text.</p>`,
  },
};

export const EmptyContent: Story = {
  args: {
    htmlContent: '',
  },
};

export const WithInlineCode: Story = {
  args: {
    htmlContent: `
      <h1>API Documentation</h1>
      <p>Use the <code>fetch()</code> API to make HTTP requests. The <code>Response</code> object contains methods like <code>json()</code> and <code>text()</code>.</p>
      <p>Remember to handle errors with <code>try/catch</code> blocks when using <code>async/await</code>.</p>
    `,
  },
};

export const LongContent: Story = {
  args: {
    htmlContent: `
      <h1>Advanced React Patterns</h1>
      <p>This comprehensive guide explores advanced React patterns that will help you write more maintainable and scalable applications. We'll cover render props, higher-order components, and modern hook patterns.</p>

      <h2>Render Props Pattern</h2>
      <p>The render props pattern is a technique for sharing code between React components using a prop whose value is a function. This pattern allows for great flexibility and reusability.</p>

      <pre><code class="language-jsx">class MouseTracker extends React.Component {
  constructor(props) {
    super(props);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.state = { x: 0, y: 0 };
  }

  handleMouseMove(event) {
    this.setState({
      x: event.clientX,
      y: event.clientY
    });
  }

  render() {
    return (
      <div style={{ height: '100vh' }} onMouseMove={this.handleMouseMove}>
        {this.props.render(this.state)}
      </div>
    );
  }
}

// Usage
function App() {
  return (
    <MouseTracker render={({ x, y }) => (
      <h1>The mouse position is ({x}, {y})</h1>
    )}/>
  );
}</code></pre>

      <h2>Higher-Order Components (HOCs)</h2>
      <p>A higher-order component is a function that takes a component and returns a new component. HOCs are useful for cross-cutting concerns.</p>

      <pre><code class="language-jsx">function withLoading(WrappedComponent) {
  return function WithLoadingComponent(props) {
    if (props.isLoading) {
      return <div>Loading...</div>;
    }
    return <WrappedComponent {...props} />;
  };
}

// Usage
const UserListWithLoading = withLoading(UserList);

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);

  return (
    <UserListWithLoading
      isLoading={isLoading}
      users={users}
    />
  );
}</code></pre>

      <h3>Modern Hook Patterns</h3>
      <p>With hooks, we can achieve similar patterns with more flexibility and less boilerplate:</p>

      <pre><code class="language-jsx">// Custom hook for mouse position
function useMouse() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function handleMouseMove(event) {
      setPosition({ x: event.clientX, y: event.clientY });
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return position;
}

// Custom hook for loading state
function useLoading(asyncFunction) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [asyncFunction]);

  return { execute, isLoading, data, error };
}</code></pre>

      <h2>Best Practices</h2>
      <ul>
        <li>Use custom hooks to encapsulate stateful logic</li>
        <li>Prefer composition over inheritance</li>
        <li>Keep components small and focused on a single responsibility</li>
        <li>Use TypeScript for better developer experience and fewer bugs</li>
        <li>Test your custom hooks in isolation</li>
      </ul>

      <h2>Performance Considerations</h2>
      <ol>
        <li>Use React.memo() for expensive components</li>
        <li>Implement useMemo() and useCallback() strategically</li>
        <li>Avoid creating objects and functions in render</li>
        <li>Use React DevTools Profiler to identify bottlenecks</li>
        <li>Consider code splitting for large applications</li>
      </ol>

      <p>These patterns and practices will help you build robust React applications that are easy to maintain and extend over time.</p>
    `,
  },
};

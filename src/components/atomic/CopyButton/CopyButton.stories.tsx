import type { Meta, StoryObj } from '@storybook/nextjs';
import { CopyButton } from './CopyButton';

const meta = {
  title: 'Features/Blog/CopyButton',
  component: CopyButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    content: {
      control: 'text',
      description: 'The content to be copied to clipboard',
    },
    onCopySuccess: {
      action: 'copy-success',
    },
    onCopyError: {
      action: 'copy-error',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'console.log("Hello, World!");',
  },
};

export const LongContent: Story = {
  args: {
    content: `function complexFunction() {
  const data = fetchData();
  const processed = processData(data);
  return formatOutput(processed);
}`,
  },
};

export const WithCustomClass: Story = {
  args: {
    content: 'Custom styled copy button',
    className: 'btn-primary',
  },
};

export const InContext: Story = {
  args: {
    content: 'npm install prismjs',
  },
  render: () => (
    <div className="mockup-code">
      <pre data-prefix="$">
        <code>npm install prismjs</code>
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton content="npm install prismjs" />
      </div>
    </div>
  ),
};

export const MultipleButtons: Story = {
  args: {
    content: 'example content',
  },
  render: () => (
    <div className="space-y-4">
      <div className="card bg-base-200 p-4">
        <div className="flex items-center justify-between">
          <code>git clone repo.git</code>
          <CopyButton content="git clone repo.git" />
        </div>
      </div>
      <div className="card bg-base-200 p-4">
        <div className="flex items-center justify-between">
          <code>cd repo && npm install</code>
          <CopyButton content="cd repo && npm install" />
        </div>
      </div>
      <div className="card bg-base-200 p-4">
        <div className="flex items-center justify-between">
          <code>npm run dev</code>
          <CopyButton content="npm run dev" />
        </div>
      </div>
    </div>
  ),
};

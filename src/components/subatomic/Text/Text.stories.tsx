import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Text } from './Text';

const meta = {
  title: 'Components/Subatomic/Text',
  component: Text,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'body',
        'lead',
        'small',
        'code',
        'emphasis',
        'caption',
      ],
    },
    children: {
      control: 'text',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'body',
    children: 'This is default body text.',
  },
};

export const Heading1: Story = {
  args: {
    variant: 'h1',
    children: 'Heading Level 1',
  },
};

export const Heading2: Story = {
  args: {
    variant: 'h2',
    children: 'Heading Level 2',
  },
};

export const Heading3: Story = {
  args: {
    variant: 'h3',
    children: 'Heading Level 3',
  },
};

export const Heading4: Story = {
  args: {
    variant: 'h4',
    children: 'Heading Level 4',
  },
};

export const Heading5: Story = {
  args: {
    variant: 'h5',
    children: 'Heading Level 5',
  },
};

export const Heading6: Story = {
  args: {
    variant: 'h6',
    children: 'Heading Level 6',
  },
};

export const Lead: Story = {
  args: {
    variant: 'lead',
    children:
      'This is lead text, typically used for introductions or key points.',
  },
};

export const Small: Story = {
  args: {
    variant: 'small',
    children: 'This is small text for less important information.',
  },
};

export const Code: Story = {
  args: {
    variant: 'code',
    children: 'const greeting = "Hello, World!";',
  },
};

export const Emphasis: Story = {
  args: {
    variant: 'emphasis',
    children: 'This text is emphasized for importance.',
  },
};

export const Caption: Story = {
  args: {
    variant: 'caption',
    children: 'Figure 1: Example caption text',
  },
};

export const AllVariants: Story = {
  args: {
    children: 'All Variants Display',
  },
  render: () => (
    <div className="space-y-4">
      <Text variant="h1">Heading 1</Text>
      <Text variant="h2">Heading 2</Text>
      <Text variant="h3">Heading 3</Text>
      <Text variant="h4">Heading 4</Text>
      <Text variant="h5">Heading 5</Text>
      <Text variant="h6">Heading 6</Text>
      <Text variant="lead">Lead paragraph text for introductions</Text>
      <Text variant="body">Regular body text for normal content</Text>
      <Text variant="small">Small text for less important info</Text>
      <Text variant="code">console.log(&quot;Code snippet&quot;)</Text>
      <Text variant="emphasis">Emphasized text for importance</Text>
      <Text variant="caption">Caption text for images or figures</Text>
    </div>
  ),
};

export const ThemeShowcase: Story = {
  args: {
    children: 'Theme Showcase',
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <div className="mt-2 space-y-1">
          <Text variant="h3">Heading</Text>
          <Text variant="body">Body text on base-100 surface</Text>
          <Text variant="small">Small text for captions</Text>
          <Text variant="code">const code = true;</Text>
        </div>
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <div className="mt-2 space-y-1">
          <Text variant="h3">Heading</Text>
          <Text variant="body">Body text on base-200 surface</Text>
          <Text variant="small">Small text for captions</Text>
          <Text variant="code">const code = true;</Text>
        </div>
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <div className="mt-2 space-y-1">
          <Text variant="h3">Heading</Text>
          <Text variant="body">Body text on neutral surface</Text>
          <Text variant="small">Small text for captions</Text>
          <Text variant="code">const code = true;</Text>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

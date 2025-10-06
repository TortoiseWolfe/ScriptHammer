import type { Meta, StoryObj } from '@storybook/nextjs';
import { Text } from './Text';

const meta = {
  title: 'Atomic Design/Subatomic/Text',
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

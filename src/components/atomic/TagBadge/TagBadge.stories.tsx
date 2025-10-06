import type { Meta, StoryObj } from '@storybook/nextjs';
import TagBadge from './TagBadge';

const meta = {
  title: 'Atomic Design/Atomic/TagBadge',
  component: TagBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Interactive tag badge component for displaying and filtering blog tags.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    tag: {
      control: 'text',
      description: 'Tag name to display',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant of the badge',
    },
    variant: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'accent'],
      description: 'Style variant of the badge',
    },
    clickable: {
      control: 'boolean',
      description: 'Whether the badge is clickable',
    },
    count: {
      control: 'number',
      description: 'Post count to display',
    },
    active: {
      control: 'boolean',
      description: 'Active/selected state',
    },
  },
} satisfies Meta<typeof TagBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tag: 'React',
  },
};

export const WithCount: Story = {
  args: {
    tag: 'TypeScript',
    count: 12,
  },
};

export const NonClickable: Story = {
  args: {
    tag: 'JavaScript',
    clickable: false,
  },
};

export const Active: Story = {
  args: {
    tag: 'Next.js',
    active: true,
  },
};

export const Sizes: Story = {
  args: {
    tag: 'Size Demo',
  },
  render: () => (
    <div className="flex items-center gap-2">
      <TagBadge tag="Small" size="sm" />
      <TagBadge tag="Medium" size="md" />
      <TagBadge tag="Large" size="lg" />
    </div>
  ),
};

export const Variants: Story = {
  args: {
    tag: 'Variant Demo',
  },
  render: () => (
    <div className="flex items-center gap-2">
      <TagBadge tag="Default" variant="default" />
      <TagBadge tag="Primary" variant="primary" />
      <TagBadge tag="Secondary" variant="secondary" />
      <TagBadge tag="Accent" variant="accent" />
    </div>
  ),
};

export const WithCustomClick: Story = {
  args: {
    tag: 'Docker',
    onClick: (tag) => alert(`Clicked tag: ${tag}`),
  },
};

export const TagCollection: Story = {
  args: {
    tag: 'Collection Demo',
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <TagBadge tag="React" count={15} />
      <TagBadge tag="TypeScript" count={12} />
      <TagBadge tag="Next.js" count={8} active />
      <TagBadge tag="Tailwind CSS" count={10} />
      <TagBadge tag="Docker" count={5} />
      <TagBadge tag="Testing" count={7} />
      <TagBadge tag="PWA" count={3} />
      <TagBadge tag="Accessibility" count={6} />
    </div>
  ),
};

export const MixedStates: Story = {
  args: {
    tag: 'Mixed Demo',
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <TagBadge tag="Active Tag" active />
      <TagBadge tag="Clickable" />
      <TagBadge tag="Non-Clickable" clickable={false} />
      <TagBadge tag="With Count" count={5} />
      <TagBadge tag="Large Primary" size="lg" variant="primary" />
    </div>
  ),
};

export const LongTagNames: Story = {
  args: {
    tag: 'Long Names Demo',
  },
  render: () => (
    <div className="flex max-w-xs flex-col gap-2">
      <TagBadge tag="Very Long Tag Name That Might Wrap" />
      <TagBadge tag="typescript-strict-mode-configuration" />
      <TagBadge tag="react-server-components" count={3} />
    </div>
  ),
};

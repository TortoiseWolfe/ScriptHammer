import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import TagCloud from './TagCloud';

const meta = {
  title: 'Features/Blog/TagCloud',
  component: TagCloud,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tag cloud component that displays tags with frequency-based sizing.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    maxTags: {
      control: 'number',
      description: 'Maximum number of tags to display',
    },
    minCount: {
      control: 'number',
      description: 'Minimum post count to display tag',
    },
    showCounts: {
      control: 'boolean',
      description: 'Show post counts next to tags',
    },
    sizeMethod: {
      control: 'select',
      options: ['linear', 'logarithmic', 'fixed'],
      description: 'Method for calculating tag sizes',
    },
  },
} satisfies Meta<typeof TagCloud>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleTags = [
  { name: 'React', count: 25 },
  { name: 'TypeScript', count: 22 },
  { name: 'Next.js', count: 18 },
  { name: 'Tailwind CSS', count: 15 },
  { name: 'Docker', count: 12 },
  { name: 'Testing', count: 10 },
  { name: 'PWA', count: 8 },
  { name: 'Accessibility', count: 7 },
  { name: 'Performance', count: 6 },
  { name: 'SEO', count: 5 },
  { name: 'GraphQL', count: 4 },
  { name: 'REST API', count: 4 },
  { name: 'Authentication', count: 3 },
  { name: 'Database', count: 3 },
  { name: 'DevOps', count: 2 },
  { name: 'Security', count: 2 },
  { name: 'UI/UX', count: 1 },
  { name: 'Mobile', count: 1 },
];

export const Default: Story = {
  args: {
    tags: sampleTags,
    showCounts: true,
  },
};

export const WithoutCounts: Story = {
  args: {
    tags: sampleTags,
    showCounts: false,
  },
};

export const LimitedTags: Story = {
  args: {
    tags: sampleTags,
    maxTags: 10,
    showCounts: true,
  },
};

export const MinimumCount: Story = {
  args: {
    tags: sampleTags,
    minCount: 5,
    showCounts: true,
  },
};

export const FixedSize: Story = {
  args: {
    tags: sampleTags,
    sizeMethod: 'fixed',
    showCounts: true,
  },
};

export const LogarithmicScaling: Story = {
  args: {
    tags: sampleTags,
    sizeMethod: 'logarithmic',
    showCounts: true,
  },
};

export const Interactive: Story = {
  args: {
    tags: sampleTags,
  },
  render: () => {
    const [selectedTags, setSelectedTags] = useState<string[]>([
      'React',
      'Next.js',
    ]);

    const handleTagClick = (tag: string) => {
      setSelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    };

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold">
            Click tags to select/deselect
          </h3>
          <p className="text-base-content/70 text-sm">
            Selected:{' '}
            {selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}
          </p>
        </div>
        <TagCloud
          tags={sampleTags}
          selectedTags={selectedTags}
          onTagClick={handleTagClick}
          showCounts={true}
        />
      </div>
    );
  },
};

export const EmptyState: Story = {
  args: {
    tags: [],
  },
};

export const SingleTag: Story = {
  args: {
    tags: [{ name: 'Lonely Tag', count: 1 }],
  },
};

export const ManyTags: Story = {
  args: {
    tags: Array.from({ length: 50 }, (_, i) => ({
      name: `Tag-${i + 1}`,
      count: Math.floor(Math.random() * 20) + 1,
    })),
    showCounts: true,
  },
};

export const UniformCounts: Story = {
  args: {
    tags: [
      { name: 'JavaScript', count: 5 },
      { name: 'Python', count: 5 },
      { name: 'Java', count: 5 },
      { name: 'C++', count: 5 },
      { name: 'Ruby', count: 5 },
      { name: 'Go', count: 5 },
    ],
    showCounts: true,
  },
};

export const ExtremeCounts: Story = {
  args: {
    tags: [
      { name: 'Super Popular', count: 1000 },
      { name: 'Very Popular', count: 500 },
      { name: 'Popular', count: 100 },
      { name: 'Normal', count: 50 },
      { name: 'Few', count: 10 },
      { name: 'Rare', count: 2 },
      { name: 'Ultra Rare', count: 1 },
    ],
    showCounts: true,
    sizeMethod: 'logarithmic',
  },
};

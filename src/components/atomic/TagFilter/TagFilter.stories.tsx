import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import TagFilter from './TagFilter';

const meta = {
  title: 'Features/Blog/TagFilter',
  component: TagFilter,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Multi-select tag filtering component with search and bulk actions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: 'select',
      options: ['checkbox', 'chips'],
      description: 'Display mode for tag selection',
    },
    showSearch: {
      control: 'boolean',
      description: 'Show search input',
    },
    showControls: {
      control: 'boolean',
      description: 'Show select all/clear buttons',
    },
    showCounts: {
      control: 'boolean',
      description: 'Show post counts',
    },
    maxHeight: {
      control: 'text',
      description: 'Maximum height before scrolling',
    },
    searchPlaceholder: {
      control: 'text',
      description: 'Placeholder text for search input',
    },
  },
} satisfies Meta<typeof TagFilter>;

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
];

const InteractiveWrapper = ({
  mode = 'checkbox' as 'checkbox' | 'chips',
  ...props
}: any) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'React',
    'Next.js',
  ]);

  return (
    <TagFilter
      {...props}
      tags={sampleTags}
      selectedTags={selectedTags}
      onChange={setSelectedTags}
      mode={mode}
    />
  );
};

export const CheckboxMode: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => <InteractiveWrapper mode="checkbox" />,
};

export const ChipsMode: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => <InteractiveWrapper mode="chips" />,
};

export const WithoutSearch: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => <InteractiveWrapper showSearch={false} />,
};

export const WithoutControls: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => <InteractiveWrapper showControls={false} />,
};

export const WithoutCounts: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => <InteractiveWrapper showCounts={false} />,
};

export const CustomHeight: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => <InteractiveWrapper maxHeight="200px" />,
};

export const CustomPlaceholder: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => <InteractiveWrapper searchPlaceholder="Find topics..." />,
};

export const EmptyState: Story = {
  args: {
    tags: [],
    selectedTags: [],
    onChange: () => {},
  },
  render: () => {
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    return (
      <TagFilter
        tags={[]}
        selectedTags={selectedTags}
        onChange={setSelectedTags}
      />
    );
  },
};

export const FullFeatures: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => (
    <InteractiveWrapper
      mode="checkbox"
      showSearch={true}
      showControls={true}
      showCounts={true}
    />
  ),
};

export const MinimalChips: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => (
    <InteractiveWrapper
      mode="chips"
      showSearch={false}
      showControls={false}
      showCounts={false}
    />
  ),
};

export const ManyTags: Story = {
  args: {
    tags: [],
    selectedTags: [],
    onChange: () => {},
  },
  render: () => {
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const manyTags = Array.from({ length: 50 }, (_, i) => ({
      name: `Tag-${i + 1}`,
      count: Math.floor(Math.random() * 20) + 1,
    }));

    return (
      <TagFilter
        tags={manyTags}
        selectedTags={selectedTags}
        onChange={setSelectedTags}
        maxHeight="400px"
      />
    );
  },
};

export const PreSelected: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => {
    const [selectedTags, setSelectedTags] = useState<string[]>([
      'React',
      'TypeScript',
      'Next.js',
      'Docker',
      'Testing',
    ]);

    return (
      <TagFilter
        tags={sampleTags}
        selectedTags={selectedTags}
        onChange={setSelectedTags}
      />
    );
  },
};

export const SideBySide: Story = {
  args: {
    tags: sampleTags,
    selectedTags: [],
    onChange: () => {},
  },
  render: () => {
    const [checkboxSelected, setCheckboxSelected] = useState<string[]>([
      'React',
    ]);
    const [chipsSelected, setChipsSelected] = useState<string[]>([
      'TypeScript',
    ]);

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">Checkbox Mode</h3>
          <TagFilter
            tags={sampleTags}
            selectedTags={checkboxSelected}
            onChange={setCheckboxSelected}
            mode="checkbox"
          />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Chips Mode</h3>
          <TagFilter
            tags={sampleTags}
            selectedTags={chipsSelected}
            onChange={setChipsSelected}
            mode="chips"
          />
        </div>
      </div>
    );
  },
};

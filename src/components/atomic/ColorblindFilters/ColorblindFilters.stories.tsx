import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { ColorblindFilters } from './ColorblindFilters';
import { ColorblindType } from '@/utils/colorblind';

/**
 * Demo component showing how ColorblindFilters work
 * Displays colored boxes that can have filters applied
 */
const ColorDemo = ({ filterType }: { filterType?: ColorblindType }) => {
  const colors = [
    { name: 'Red', hex: '#FF0000', bg: 'bg-red-500' },
    { name: 'Green', hex: '#00FF00', bg: 'bg-green-500' },
    { name: 'Blue', hex: '#0000FF', bg: 'bg-blue-500' },
    { name: 'Yellow', hex: '#FFFF00', bg: 'bg-yellow-500' },
    { name: 'Purple', hex: '#800080', bg: 'bg-purple-500' },
    { name: 'Orange', hex: '#FFA500', bg: 'bg-orange-500' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-center">
        <h3 className="text-lg font-bold">
          {filterType
            ? `${filterType} Simulation`
            : 'Original Colors (No Filter)'}
        </h3>
        <p className="mt-1 text-sm opacity-70">
          {filterType
            ? 'How colors appear with this type of color blindness'
            : 'Normal color vision'}
        </p>
      </div>
      <div
        className="grid grid-cols-3 gap-4"
        style={filterType ? { filter: `url(#${filterType})` } : {}}
      >
        {colors.map((color) => (
          <div key={color.name} className="flex flex-col items-center gap-2">
            <div className={`h-20 w-20 rounded-lg ${color.bg}`} />
            <span className="text-sm font-medium">{color.name}</span>
            <span className="text-xs opacity-60">{color.hex}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const meta = {
  title: 'Layout/Theme/ColorblindFilters',
  component: ColorblindFilters,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
ColorblindFilters provides SVG filter definitions for simulating different types of color blindness.
This component renders hidden SVG filters that can be applied to any element using CSS.

**Usage**: Include this component once in your app (e.g., in root layout), then apply filters to elements:
\`\`\`tsx
<ColorblindFilters />
<div style={{ filter: 'url(#protanopia)' }}>
  Content to filter
</div>
\`\`\`

**Available Filters**:
- \`protanopia\`: Red-blind (no red cones)
- \`protanomaly\`: Red-weak (anomalous red cones)
- \`deuteranopia\`: Green-blind (no green cones)
- \`deuteranomaly\`: Green-weak (anomalous green cones)
- \`tritanopia\`: Blue-blind (no blue cones)
- \`tritanomaly\`: Blue-weak (anomalous blue cones)
- \`achromatopsia\`: Complete color blindness
- \`achromatomaly\`: Partial color blindness
        `,
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ColorblindFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The component itself is invisible - it only provides filter definitions.
 * See the other stories for visual demonstrations of how filters affect colors.
 */
export const Default: Story = {
  args: {},
  render: (args) => (
    <div className="flex flex-col items-center gap-4">
      <ColorblindFilters {...args} />
      <div className="card bg-base-100 max-w-md p-6 shadow-xl">
        <p className="text-center">
          ℹ️ ColorblindFilters component is invisible - it provides SVG filter
          definitions. See the demonstration stories below to see how filters
          affect colors.
        </p>
      </div>
    </div>
  ),
};

/**
 * Original colors without any filter applied.
 * Use this as a baseline to compare with filtered versions.
 */
export const NoFilter: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo />
    </>
  ),
};

/**
 * Protanopia (Red-Blind) simulation.
 * People with protanopia lack red cones and cannot perceive red light.
 * Red and green appear similar, often brownish or yellowish.
 */
export const Protanopia: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.PROTANOPIA} />
    </>
  ),
};

/**
 * Protanomaly (Red-Weak) simulation.
 * Reduced sensitivity to red light, but not complete absence.
 * Colors appear less vibrant, red/green distinction is difficult.
 */
export const Protanomaly: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.PROTANOMALY} />
    </>
  ),
};

/**
 * Deuteranopia (Green-Blind) simulation.
 * People with deuteranopia lack green cones.
 * Red and green appear similar, often brownish.
 */
export const Deuteranopia: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.DEUTERANOPIA} />
    </>
  ),
};

/**
 * Deuteranomaly (Green-Weak) simulation.
 * Most common form of color blindness (~5% of males).
 * Reduced sensitivity to green light.
 */
export const Deuteranomaly: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.DEUTERANOMALY} />
    </>
  ),
};

/**
 * Tritanopia (Blue-Blind) simulation.
 * People with tritanopia lack blue cones.
 * Blue and yellow appear similar, often greenish or pink.
 */
export const Tritanopia: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.TRITANOPIA} />
    </>
  ),
};

/**
 * Tritanomaly (Blue-Weak) simulation.
 * Reduced sensitivity to blue light.
 * Blue/yellow distinction is difficult.
 */
export const Tritanomaly: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.TRITANOMALY} />
    </>
  ),
};

/**
 * Achromatopsia (Complete Color Blindness) simulation.
 * Very rare condition - complete absence of color vision.
 * Only black, white, and shades of gray are visible.
 */
export const Achromatopsia: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.ACHROMATOPSIA} />
    </>
  ),
};

/**
 * Achromatomaly (Partial Color Blindness) simulation.
 * Reduced color perception across all cones.
 * Colors appear muted and washed out.
 */
export const Achromatomaly: Story = {
  render: () => (
    <>
      <ColorblindFilters />
      <ColorDemo filterType={ColorblindType.ACHROMATOMALY} />
    </>
  ),
};

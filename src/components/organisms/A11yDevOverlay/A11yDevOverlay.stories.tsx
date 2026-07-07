import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { Result } from 'axe-core';
import A11yDevOverlay from './A11yDevOverlay';

const mockViolations: Result[] = [
  {
    id: 'button-name',
    impact: 'critical',
    description: 'Buttons must have discernible text',
    help: 'Buttons must have discernible text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/button-name',
    tags: ['wcag2a', 'wcag412'],
    nodes: [
      {
        html: '<button class="icon-only"></button>',
        target: ['.icon-only'],
        any: [],
        all: [],
        none: [],
        failureSummary: 'Element has no discernible text',
      },
    ],
  },
  {
    id: 'color-contrast',
    impact: 'serious',
    description: 'Elements must meet minimum color contrast ratio thresholds',
    help: 'Elements must have sufficient color contrast',
    helpUrl: 'https://dequeuniversity.com/rules/axe/color-contrast',
    tags: ['wcag2aa', 'wcag143'],
    nodes: [
      {
        html: '<p class="muted">Low contrast text</p>',
        target: ['.muted'],
        any: [],
        all: [],
        none: [],
        failureSummary: 'Contrast ratio is below 4.5:1',
      },
    ],
  },
  {
    id: 'label',
    impact: 'moderate',
    description: 'Form elements must have labels',
    help: 'Form elements must have labels',
    helpUrl: 'https://dequeuniversity.com/rules/axe/label',
    tags: ['wcag2a', 'wcag412'],
    nodes: [
      {
        html: '<input type="text" />',
        target: ['input'],
        any: [],
        all: [],
        none: [],
        failureSummary: 'Form element has no label',
      },
    ],
  },
  {
    id: 'region',
    impact: 'minor',
    description: 'All page content should be contained by landmarks',
    help: 'All page content should be contained by landmarks',
    helpUrl: 'https://dequeuniversity.com/rules/axe/region',
    tags: ['best-practice'],
    nodes: [
      {
        html: '<div class="loose"></div>',
        target: ['.loose'],
        any: [],
        all: [],
        none: [],
        failureSummary: 'Content is not inside a landmark',
      },
    ],
  },
];

const meta: Meta<typeof A11yDevOverlay> = {
  title: 'Components/Organisms/A11yDevOverlay',
  component: A11yDevOverlay,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dev-only floating accessibility overlay. In the real app it runs a live axe-core ' +
          'scan; these stories pass deterministic mock violations via the `violations` prop. ' +
          'A collapsed badge shows the count (color-coded by worst impact) and expands into a ' +
          'panel with impact filters, rule-id search, and click-to-highlight.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    violations: {
      control: false,
      description: 'axe-core violations to display (overrides the live scan).',
    },
    defaultExpanded: {
      control: 'boolean',
      description: 'Start in the expanded panel state.',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    violations: [],
    defaultExpanded: true,
  },
};

export const WithViolations: Story = {
  args: {
    violations: mockViolations,
    defaultExpanded: true,
  },
};

export const CollapsedButton: Story = {
  args: {
    violations: mockViolations,
    defaultExpanded: false,
  },
};

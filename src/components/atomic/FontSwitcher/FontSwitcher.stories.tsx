import type { Meta, StoryObj } from '@storybook/nextjs';
import { FontSwitcher } from './FontSwitcher';

const meta = {
  title: 'Layout/Theme/FontSwitcher',
  component: FontSwitcher,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof FontSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'custom-class',
  },
};

export const AllFonts: Story = {
  name: 'All Font Options',
  render: () => (
    <div className="space-y-4">
      <div className="text-lg font-bold">Font Switcher Component</div>
      <FontSwitcher />
      <div className="divider"></div>
      <div className="text-sm opacity-70">
        <p>Available fonts:</p>
        <ul className="mt-2 list-inside list-disc">
          <li>System Default - OS native font</li>
          <li>Inter - Modern screen-optimized font</li>
          <li>OpenDyslexic - Dyslexia-friendly font</li>
          <li>Atkinson Hyperlegible - Maximum legibility</li>
          <li>Georgia - Classic serif font</li>
          <li>JetBrains Mono - Developer monospace font</li>
        </ul>
      </div>
    </div>
  ),
};

export const WithAccessibilityInfo: Story = {
  name: 'Accessibility Features',
  render: () => (
    <div className="space-y-4">
      <div className="alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="h-6 w-6 shrink-0 stroke-current"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <h3 className="font-bold">Accessibility Features</h3>
          <div className="text-xs">
            This component includes fonts specifically designed for
            accessibility
          </div>
        </div>
      </div>
      <FontSwitcher />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="card bg-base-200 p-4">
          <div className="badge badge-success mb-2">dyslexia-friendly</div>
          <div className="text-sm">
            OpenDyslexic uses weighted bottoms and unique letter shapes to help
            with dyslexia
          </div>
        </div>
        <div className="card bg-base-200 p-4">
          <div className="badge badge-success mb-2">high-readability</div>
          <div className="text-sm">
            Atkinson Hyperlegible provides maximum character distinction for low
            vision readers
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  name: 'Interactive Demo',
  render: () => (
    <div className="bg-base-200 space-y-4 rounded-lg p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Try Different Fonts</h2>
        <FontSwitcher />
      </div>
      <div className="divider"></div>
      <div className="space-y-4">
        <p className="text-lg">The quick brown fox jumps over the lazy dog.</p>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <pre className="bg-base-300 rounded p-4">
          {`const code = {
  font: 'changes',
  with: 'selection'
};`}
        </pre>
      </div>
    </div>
  ),
};

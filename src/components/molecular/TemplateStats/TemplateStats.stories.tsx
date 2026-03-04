import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import TemplateStats from './TemplateStats';

const SAMPLE_STATS = [
  {
    value: '32',
    label: 'Themes',
    detail: 'DaisyUI · live switching',
    href: '/themes',
  },
  {
    value: '2,400+',
    label: 'Tests',
    detail: 'Unit · a11y · E2E',
    href: '/status',
  },
  {
    value: 'WCAG AA',
    label: 'Accessible',
    detail: 'Skip links · font scaling',
    href: '/accessibility',
  },
  {
    value: 'PWA',
    label: 'Offline-first',
    detail: 'Service worker · installable',
    href: '/docs',
  },
];

const SAMPLE_DEMOS = [
  { label: 'Blog', href: '/blog' },
  { label: 'Payments', href: '/payment-demo' },
  { label: 'Messaging', href: '/messages' },
  { label: 'Map', href: '/map' },
  { label: 'Game', href: '/game' },
];

const meta: Meta<typeof TemplateStats> = {
  title: 'Components/Molecular/TemplateStats',
  component: TemplateStats,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "proof" section of a template landing page. Headline ' +
          'capability numbers link to their evidence pages; optional demo ' +
          'links sit below at low visual weight. Uses only DaisyUI semantic ' +
          'tokens — see the ThemeShowcase story for multi-theme verification.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stats: SAMPLE_STATS,
    demos: SAMPLE_DEMOS,
  },
};

export const StatsOnly: Story = {
  args: {
    stats: SAMPLE_STATS,
  },
};

export const TwoStats: Story = {
  args: {
    stats: SAMPLE_STATS.slice(0, 2),
    demos: SAMPLE_DEMOS.slice(0, 3),
  },
};

/**
 * Multi-theme verification — the task constraint is "every color must use
 * DaisyUI semantic tokens; check against at least 3 themes." This story IS
 * that check. The same component renders under four themes; if any surface
 * or text color were hardcoded, one of these panels would break visibly
 * (white-on-white text, invisible borders, etc.).
 *
 * Themes chosen for maximum spread:
 * - `light`    — default light surfaces
 * - `dark`     — default dark surfaces
 * - `synthwave` — saturated neon, catches low-contrast mistakes
 * - `wireframe` — near-monochrome, catches reliance on brand-color contrast
 */
export const ThemeShowcase: Story = {
  args: {
    stats: SAMPLE_STATS,
    demos: SAMPLE_DEMOS.slice(0, 4),
  },
  render: (args) => (
    <div className="flex flex-col">
      {(['light', 'dark', 'synthwave', 'wireframe'] as const).map((theme) => (
        <div key={theme} data-theme={theme} className="bg-base-200">
          <div className="text-base-content/60 px-4 pt-4 font-mono text-xs">
            data-theme=&quot;{theme}&quot;
          </div>
          <TemplateStats {...args} />
        </div>
      ))}
    </div>
  ),
  parameters: { layout: 'fullscreen' },
};

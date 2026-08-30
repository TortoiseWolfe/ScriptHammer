import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ErrorBoundary from './ErrorBoundary';

const Boom = () => {
  throw new Error('This child threw on purpose, to show the fallback.');
};

const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Catches a throw anywhere below it and shows a fallback instead of an empty page. `level` decides how loudly: a page error is CRITICAL and stays put, while a component error is MEDIUM and clears itself after ten seconds. In `layout.tsx` it wraps `#main-content`, not the whole tree — the nav and footer survive a page-level crash.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    level: {
      control: { type: 'select' },
      options: ['page', 'section', 'component'],
    },
  },
  args: { level: 'component', children: <Boom /> },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: recoverable, and it retries itself after ten seconds. */
export const ComponentLevel: Story = {};

/** Louder wording; no auto-recovery. */
export const SectionLevel: Story = { args: { level: 'section' } };

/** CRITICAL, and the only level that offers a way out of the page. */
export const PageLevel: Story = { args: { level: 'page' } };

/** Supply your own UI and the boundary renders that instead. */
export const CustomFallback: Story = {
  args: {
    fallback: (
      <div className="alert alert-warning">
        Comments are unavailable right now.
      </div>
    ),
  },
};

/** Nothing threw, so the boundary is invisible — which is its normal state. */
export const NoError: Story = {
  args: { children: <p className="p-4">Everything is fine here.</p> },
};

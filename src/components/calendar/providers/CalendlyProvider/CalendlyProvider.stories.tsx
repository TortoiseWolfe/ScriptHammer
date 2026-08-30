import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendlyProvider } from './CalendlyProvider';

const meta = {
  title: 'Features/Calendar/CalendlyProvider',
  component: CalendlyProvider,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Calendly half of `CalendarEmbed`, loaded lazily and only after functional consent. It derives the widget’s brand colour from the active DaisyUI theme (#39) rather than hardcoding one — but note that react-calendly builds its iframe once on mount, so switching theme does not recolour an already-rendered widget. **These stories load real third-party content from calendly.com.**',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    mode: { control: { type: 'select' }, options: ['inline', 'popup'] },
    url: { control: 'text' },
  },
  args: { url: 'https://calendly.com/example/intro', mode: 'inline' },
} satisfies Meta<typeof CalendlyProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

/** A trigger button; the modal mounts into a portal at the document root. */
export const Popup: Story = { args: { mode: 'popup' } };

/** Shorter than the 1200px default, for a page that frames the embed itself. */
export const CustomHeight: Story = {
  args: { styles: { height: '600px', minHeight: '500px' } },
};

/** Prefilled from what the app already knows, so the visitor retypes nothing. */
export const Prefilled: Story = {
  args: { prefill: { name: 'Ada Lovelace', email: 'ada@example.com' } },
};

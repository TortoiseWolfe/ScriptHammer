import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalComProvider } from './CalComProvider';

const meta = {
  title: 'Features/Calendar/CalComProvider',
  component: CalComProvider,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Cal.com half of `CalendarEmbed`, loaded lazily and only after functional consent. Its brand colour comes from the active DaisyUI theme (#39); the embed initialises once, so switching theme does not recolour a widget that is already up. **These stories load real third-party content from cal.com.**',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    mode: { control: { type: 'select' }, options: ['inline', 'popup'] },
    calLink: { control: 'text' },
  },
  args: { calLink: 'example/intro', mode: 'inline' },
} satisfies Meta<typeof CalComProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

/** A real <button>, which is what makes the data-attribute wiring keyboard-reachable. */
export const Popup: Story = { args: { mode: 'popup' } };

export const CustomHeight: Story = {
  args: { styles: { height: '900px', minHeight: '700px' } },
};

/** Prefilled from what the app already knows. `theme` is always overridden by the site's. */
export const Prefilled: Story = {
  args: { config: { name: 'Ada Lovelace', email: 'ada@example.com' } },
};

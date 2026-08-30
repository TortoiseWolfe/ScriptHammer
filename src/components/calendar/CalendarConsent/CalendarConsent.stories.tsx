import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CalendarConsent from './CalendarConsent';
import { withConsentProvider } from '../../../../.storybook/decorators';

const meta = {
  title: 'Features/Calendar/CalendarConsent',
  component: CalendarConsent,
  decorators: [withConsentProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'What `/schedule` shows before third-party cookies are accepted — which makes it the front door for every booking link in the product (#919). It leads with the goal rather than the mechanism, and offers a way through for someone who does not want the embed at all.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    provider: { control: { type: 'select' }, options: ['calendly', 'calcom'] },
    url: { control: 'text' },
  },
  args: {
    provider: 'calendly',
    url: 'https://calendly.com/example/intro',
  },
} satisfies Meta<typeof CalendarConsent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Calendly: Story = {};

export const CalCom: Story = {
  args: { provider: 'calcom', url: 'https://cal.com/example/intro' },
};

/**
 * A misconfigured deployment has no booking URL. The escape hatch disappears rather
 * than rendering a dead link — but note what that costs: this state dead-ends anyone
 * who will not accept third-party cookies.
 */
export const NoBookingUrl: Story = { args: { url: undefined } };

import type { Meta, StoryObj } from '@storybook/nextjs';
import CalendarEmbed from './CalendarEmbed';
import { withConsentProvider } from '../../../../.storybook/decorators';

const meta: Meta<typeof CalendarEmbed> = {
  id: 'atomic-calendarembed',
  title: 'Features/Calendar/CalendarEmbed',
  component: CalendarEmbed,
  decorators: [withConsentProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Calendar embedding component supporting multiple providers',
      },
    },
  },
  argTypes: {
    mode: {
      control: { type: 'select' },
      options: ['inline', 'popup'],
      description: 'Display mode for the calendar',
    },
    provider: {
      control: { type: 'select' },
      options: ['calendly', 'calcom'],
      description: 'Calendar provider to use',
    },
    url: {
      control: { type: 'text' },
      description: 'Calendar URL',
    },
    prefill: {
      control: { type: 'object' },
      description: 'Prefill data for booking',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    mode: 'inline',
    provider: 'calendly',
    url: '',
  },
  parameters: {
    docs: {
      storyDescription: 'Default calendar embed in inline mode',
    },
  },
};

export const InlineMode: Story = {
  args: {
    mode: 'inline',
    provider: 'calendly',
  },
};

export const PopupMode: Story = {
  args: {
    mode: 'popup',
    provider: 'calendly',
  },
};

export const WithCalendly: Story = {
  args: {
    mode: 'inline',
    provider: 'calendly',
    url: 'https://calendly.com/example',
  },
};

export const WithCalCom: Story = {
  args: {
    mode: 'inline',
    provider: 'calcom',
    url: 'example/meeting',
  },
};

export const WithPrefill: Story = {
  args: {
    mode: 'inline',
    provider: 'calendly',
    prefill: {
      name: 'John Doe',
      email: 'john.doe@example.com',
    },
  },
};

export const CustomStyling: Story = {
  args: {
    mode: 'inline',
    className: 'custom-calendar-wrapper',
  },
};

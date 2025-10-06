import type { Meta, StoryObj } from '@storybook/nextjs';
import { ContactForm } from './ContactForm';

const meta = {
  title: 'Features/Forms/ContactForm',
  component: ContactForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-base-100 min-h-screen p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ContactForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default state - ready to fill
export const Default: Story = {
  args: {},
};

// Interactive story - fill and submit
export const FillAndSubmit: Story = {
  args: {},
};

// With custom callbacks
export const WithCallbacks: Story = {
  args: {
    onSuccess: (response) => {
      console.log('Form submitted successfully:', response);
    },
    onError: (error) => {
      console.error('Form submission error:', error);
    },
  },
};

// Dark theme
export const DarkTheme: Story = {
  args: {},
  decorators: [
    (Story) => (
      <div className="bg-base-100 min-h-screen p-8" data-theme="dark">
        <Story />
      </div>
    ),
  ],
};

// Mobile view
export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

// Tablet view
export const Tablet: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

// Offline scenario - will queue the submission
export const OfflineSubmission: Story = {
  args: {},
};

// Validation errors
export const ValidationErrors: Story = {
  args: {},
};

// Pre-filled form
export const PreFilled: Story = {
  args: {},
};

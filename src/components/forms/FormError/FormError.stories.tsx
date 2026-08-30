import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormError } from './FormError';

const meta = {
  title: 'Features/Forms/FormError',
  component: FormError,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Field-level error message. Renders `null` when `error` is empty, so a form can mount one per field unconditionally. Announces through an `aria-live="polite"` alert region rather than moving focus.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    error: {
      control: 'text',
      description: 'The message. Empty renders nothing.',
    },
    id: {
      control: 'text',
      description: 'Target for a field’s aria-describedby.',
    },
    animate: { control: 'boolean', description: 'Slide/fade in on appear.' },
  },
} satisfies Meta<typeof FormError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { error: 'Email is required' } };
export const WithoutAnimation: Story = {
  args: { error: 'Email is required', animate: false },
};
export const Empty: Story = {
  args: { error: '' },
  parameters: {
    docs: {
      description: { story: 'No error: the component renders nothing at all.' },
    },
  },
};

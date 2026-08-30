import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { z } from 'zod';
import { ValidatedInput } from './ValidatedInput';

const emailSchema = z.string().email('Enter a valid email address');

const meta = {
  title: 'Features/Forms/ValidatedInput',
  component: ValidatedInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'An input that validates itself against a Zod schema. It stays quiet until the field is blurred, so it does not shout at someone mid-word, and debounces change-validation. Give it a `name` — the error id and `aria-describedby` are both derived from it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    name: 'email',
    'aria-label': 'Email',
    placeholder: 'you@example.com',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ValidatedInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Type something invalid and tab away — validation waits for blur. */
export const WithSchema: Story = { args: { schema: emailSchema } };

/** A server said so: an external error applies without the field being touched. */
export const ExternalError: Story = { args: { error: 'That email is taken' } };

export const Loading: Story = { args: { loading: true } };

export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };

/** No icon column, for dense forms. */
export const WithoutStateIcon: Story = {
  args: { schema: emailSchema, showStateIcon: false },
};

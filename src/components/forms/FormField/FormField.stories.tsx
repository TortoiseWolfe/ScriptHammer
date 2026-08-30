import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormField, getFormFieldInputProps } from './FormField';

const meta = {
  title: 'Features/Forms/FormField',
  component: FormField,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Label, help text and error around an input you supply. The field renders its children untouched, so pair it with `getFormFieldInputProps` — that helper is what wires `id`, `aria-invalid` and `aria-describedby` to match what the wrapper renders.',
      },
    },
  },
  tags: ['autodocs'],
  // `children` is a required prop, so meta must supply one even though every story
  // below overrides the whole render — without it the render-only stories do not
  // type-check.
  args: {
    label: 'Email Address',
    name: 'email',
    children: <input type="email" />,
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

const field = (props: Record<string, unknown>) => (
  <div className="w-80">
    <FormField label="Email Address" name="email" {...props}>
      <input
        type="email"
        placeholder="you@example.com"
        {...getFormFieldInputProps({ name: 'email', ...props })}
      />
    </FormField>
  </div>
);

export const Default: Story = { render: () => field({}) };
export const Required: Story = { render: () => field({ required: true }) };
export const WithHelpText: Story = {
  render: () => field({ helpText: 'We will never share your email' }),
};
export const WithError: Story = {
  render: () => field({ error: 'Enter a valid email address' }),
};

/** Help text is dropped once there is an error, and the description follows it. */
export const ErrorReplacesHelpText: Story = {
  render: () =>
    field({
      error: 'Enter a valid email address',
      helpText: 'We will never share your email',
    }),
};

/** Still announced; just not drawn. */
export const HiddenLabel: Story = { render: () => field({ hideLabel: true }) };

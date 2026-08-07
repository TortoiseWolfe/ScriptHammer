import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import IntakeForm from './IntakeForm';

const meta: Meta<typeof IntakeForm> = {
  title: 'Features/Forms/IntakeForm',
  component: IntakeForm,
  parameters: { layout: 'padded' },
  args: { onSubmit: (d) => console.log('intake', d) },
};
export default meta;
type Story = StoryObj<typeof IntakeForm>;

export const Default: Story = {};
export const Submitting: Story = { args: { busy: true } };
export const WithAmount: Story = { args: { submitLabel: 'Pay $600.00' } };

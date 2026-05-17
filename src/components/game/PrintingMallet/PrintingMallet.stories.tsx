import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PrintingMallet from './PrintingMallet';

const meta: Meta<typeof PrintingMallet> = {
  title: 'Features/Game/PrintingMallet',
  component: PrintingMallet,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Procedural compositor mallet (head + handle + wedge) tilted 42° per the canonical brand pose. Renders nothing outside a Canvas.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {
  args: {},
  render: () => <PrintingMallet />,
} as unknown as Story;

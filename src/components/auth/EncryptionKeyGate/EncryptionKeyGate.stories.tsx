import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import EncryptionKeyGate from './EncryptionKeyGate';
import { withAuthProvider } from '../../../../.storybook/decorators';

const meta: Meta<typeof EncryptionKeyGate> = {
  title: 'Features/Authentication/EncryptionKeyGate',
  component: EncryptionKeyGate,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Render-gate for E2E encryption keys. Three states: no keys → redirect to /messages/setup; keys in DB but not memory → ReAuthModal; keys in memory → render children. Extracted from the messages page.',
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <EncryptionKeyGate>
      <div className="p-8">
        <h2 className="text-xl font-semibold">Protected messaging content</h2>
        <p className="text-base-content/85">
          This only renders once encryption keys are confirmed in memory.
        </p>
      </div>
    </EncryptionKeyGate>
  ),
};

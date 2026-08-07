import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import IntakeUploader from './IntakeUploader';
import type { IntakeAttachment } from '@/types/commerce';

const meta: Meta<typeof IntakeUploader> = {
  title: 'Features/Forms/IntakeUploader',
  component: IntakeUploader,
  parameters: { layout: 'padded' },
  args: { value: [], onChange: (a) => console.log('attachments', a) },
};
export default meta;
type Story = StoryObj<typeof IntakeUploader>;

const a = (over: Partial<IntakeAttachment>): IntakeAttachment => ({
  path: 'uid/x',
  name: 'file',
  bytes: 480_000,
  mime: 'image/png',
  kind: 'unspecified',
  ...over,
});

export const Empty: Story = {};

export const Tagged: Story = {
  args: {
    value: [
      a({ path: 'uid/1', name: 'current-site.png', kind: 'current' }),
      a({ path: 'uid/2', name: 'the-look-i-want.png', kind: 'target' }),
    ],
  },
};

/** FR-018 — accepted, but no thumbnail exists for either of these. */
export const FormatsWeCannotPreview: Story = {
  args: {
    value: [
      a({ path: 'uid/3', name: 'IMG_0421.HEIC', mime: 'image/heic' }),
      a({ path: 'uid/4', name: 'quote.pdf', mime: 'application/pdf' }),
    ],
  },
};

/** At the cap the dropzone stops accepting input rather than failing on drop. */
export const Full: Story = {
  args: {
    value: Array.from({ length: 8 }, (_, i) =>
      a({ path: `uid/${i}`, name: `photo-${i + 1}.jpg`, mime: 'image/jpeg' })
    ),
  },
};

export const Disabled: Story = {
  args: { value: [a({ path: 'uid/1', name: 'roof.png' })], disabled: true },
};

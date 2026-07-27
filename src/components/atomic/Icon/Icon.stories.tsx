import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Icon from './Icon';
import { ICON_NAMES } from './icons';

const meta: Meta<typeof Icon> = {
  title: 'Components/Atomic/Icon',
  component: Icon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The Machine Shop line-icon set (#377). Icons are path data rendered ' +
          'by one component, drawn on a 24-unit grid with a 2-unit ' +
          '`currentColor` stroke. Every icon takes either a `label` or ' +
          '`decorative` — there is no unlabelled default.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'select',
      options: ICON_NAMES,
      description: 'Which icon to draw',
    },
    size: {
      control: 'text',
      description: 'Rendered size; defaults to 1em so it tracks the font size',
    },
    className: { control: 'text', description: 'Additional CSS classes' },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: { name: 'menu', label: 'Open menu', size: 32 },
};

/** The whole set, which is also the quickest way to spot an off-grid drawing. */
export const AllIcons: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-6 sm:grid-cols-6">
      {ICON_NAMES.map((name) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Icon name={name} decorative size={28} />
          <span className="font-mono text-xs opacity-70">{name}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Icons default to `1em`, so they scale with surrounding text — including when
 * a user raises the accessibility font size, where a fixed pixel icon would
 * shrink relative to the words beside it.
 */
export const ScalesWithText: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {['text-sm', 'text-base', 'text-2xl', 'text-4xl'].map((size) => (
        <p key={size} className={`flex items-center gap-2 ${size}`}>
          <Icon name="check" decorative />
          <span>Scales with {size}</span>
        </p>
      ))}
    </div>
  ),
};

/** `currentColor` is what lets one drawing serve every theme and text colour. */
export const InheritsColour: Story = {
  render: () => (
    <div className="flex gap-4 text-3xl">
      <Icon name="alert" label="Error" className="text-error" />
      <Icon name="check" label="Success" className="text-success" />
      <Icon name="settings" label="Settings" className="text-primary" />
      <Icon name="theme" label="Theme" className="text-base-content" />
    </div>
  ),
};

/** The depth primitives from #377, with icons sitting on them. */
export const OnDepthSurfaces: Story = {
  render: () => (
    <div className="bg-base-200 flex gap-4 p-8">
      <div className="sh-plate bg-base-100 rounded-box p-4 text-2xl">
        <Icon name="home" label="Home" />
      </div>
      <div className="sh-well bg-base-100 rounded-box p-4 text-2xl">
        <Icon name="messages" label="Messages" />
      </div>
      <div className="sh-groove bg-base-100 rounded-field p-4 text-2xl">
        <Icon name="type" label="Typography" />
      </div>
    </div>
  ),
};

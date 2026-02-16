import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';

const meta = {
  title: 'Atomic Design/Atomic/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    a11y: {
      // Accessibility configuration for all stories
      config: {
        rules: [
          {
            // Button components should have accessible names
            id: 'button-name',
            enabled: true,
          },
          {
            // Color contrast should meet WCAG AA standards
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'accent',
        'ghost',
        'link',
        'info',
        'success',
        'warning',
        'error',
      ],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
    },
    outline: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
    wide: {
      control: 'boolean',
    },
    glass: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary',
  },
};

export const Accent: Story = {
  args: {
    children: 'Accent Button',
    variant: 'accent',
  },
};

export const Ghost: Story = {
  args: {
    children: 'Ghost Button',
    variant: 'ghost',
  },
};

export const Link: Story = {
  args: {
    children: 'Link Button',
    variant: 'link',
  },
};

export const Success: Story = {
  args: {
    children: 'Success',
    variant: 'success',
  },
};

export const Warning: Story = {
  args: {
    children: 'Warning',
    variant: 'warning',
  },
};

export const Error: Story = {
  args: {
    children: 'Error',
    variant: 'error',
  },
};

export const Small: Story = {
  args: {
    children: 'Small Button',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Button',
    size: 'lg',
  },
};

export const Outline: Story = {
  args: {
    children: 'Outline Button',
    outline: true,
  },
};

export const Loading: Story = {
  args: {
    children: 'Loading...',
    loading: true,
  },
};

export const Wide: Story = {
  args: {
    children: 'Wide Button',
    wide: true,
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};

export const AllVariants: Story = {
  args: {
    children: 'Button',
  },
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="info">Info</Button>
        <Button variant="success">Success</Button>
        <Button variant="warning">Warning</Button>
        <Button variant="error">Error</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="xs">Extra Small</Button>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button outline>Outline</Button>
        <Button loading>Loading</Button>
        <Button wide>Wide Button</Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  ),
};

export const ThemeShowcase: Story = {
  args: {
    children: 'Button',
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          Solid Variants
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="info">Info</Button>
          <Button variant="success">Success</Button>
          <Button variant="warning">Warning</Button>
          <Button variant="error">Error</Button>
        </div>
      </div>
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          Outline Variants
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" outline>
            Primary
          </Button>
          <Button variant="secondary" outline>
            Secondary
          </Button>
          <Button variant="accent" outline>
            Accent
          </Button>
          <Button variant="info" outline>
            Info
          </Button>
          <Button variant="success" outline>
            Success
          </Button>
          <Button variant="warning" outline>
            Warning
          </Button>
          <Button variant="error" outline>
            Error
          </Button>
        </div>
      </div>
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">States</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Default</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          On Surfaces
        </h3>
        <div className="flex flex-col gap-3">
          <div className="bg-base-100 flex flex-wrap gap-2 rounded-lg p-4">
            <span className="text-base-content text-sm opacity-60">
              base-100:
            </span>
            <Button variant="primary" size="sm">
              Primary
            </Button>
            <Button variant="secondary" size="sm">
              Secondary
            </Button>
            <Button variant="accent" size="sm">
              Accent
            </Button>
          </div>
          <div className="bg-base-200 flex flex-wrap gap-2 rounded-lg p-4">
            <span className="text-base-content text-sm opacity-60">
              base-200:
            </span>
            <Button variant="primary" size="sm">
              Primary
            </Button>
            <Button variant="secondary" size="sm">
              Secondary
            </Button>
            <Button variant="accent" size="sm">
              Accent
            </Button>
          </div>
          <div className="bg-neutral flex flex-wrap gap-2 rounded-lg p-4">
            <span className="text-neutral-content text-sm opacity-60">
              neutral:
            </span>
            <Button variant="primary" size="sm">
              Primary
            </Button>
            <Button variant="secondary" size="sm">
              Secondary
            </Button>
            <Button variant="accent" size="sm">
              Accent
            </Button>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Card } from './Card';
import { Button } from '../Button/Button';

const meta = {
  title: 'Components/Atomic/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    a11y: {
      config: {
        rules: [
          {
            // Images should have alt text
            id: 'image-alt',
            enabled: true,
          },
          {
            // Color contrast for text
            id: 'color-contrast',
            enabled: true,
          },
          {
            // Ensure proper heading hierarchy
            id: 'heading-order',
            enabled: true,
          },
        ],
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    compact: {
      control: 'boolean',
    },
    side: {
      control: 'boolean',
    },
    glass: {
      control: 'boolean',
    },
    bordered: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    title: 'Card Title',
    subtitle: 'Card subtitle goes here',
    children:
      'This is the card content. You can put any content here including text, images, or other components.',
  },
};

export const WithImage: Story = {
  args: {
    title: 'Beautiful Landscape',
    image: {
      src: 'https://picsum.photos/400/300',
      alt: 'Random landscape',
    },
    children:
      'Cards can display images at the top. This is useful for showcasing visual content.',
  },
};

export const WithActions: Story = {
  args: {
    title: 'Action Card',
    children: 'This card has action buttons at the bottom.',
    actions: (
      <>
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </>
    ),
  },
};

export const Compact: Story = {
  args: {
    title: 'Compact Card',
    children: 'This card has reduced padding for a more compact appearance.',
    compact: true,
  },
};

export const SideImage: Story = {
  args: {
    title: 'Side Image Card',
    image: {
      src: 'https://picsum.photos/200/200',
      alt: 'Square image',
    },
    children: 'The image appears on the side when using the side prop.',
    side: true,
    actions: <Button variant="primary">Learn More</Button>,
  },
};

export const Glass: Story = {
  args: {
    title: 'Glass Effect',
    children: 'This card has a glassmorphism effect applied to it.',
    glass: true,
  },
};

export const Bordered: Story = {
  args: {
    title: 'Bordered Card',
    children: 'This card has a visible border.',
    bordered: true,
  },
};

export const CompleteExample: Story = {
  args: {
    title: 'Premium Feature',
    subtitle: 'Unlock advanced capabilities',
    image: {
      src: 'https://picsum.photos/400/250',
      alt: 'Feature image',
    },
    children: (
      <div className="space-y-2">
        <p>Get access to exclusive features:</p>
        <ul className="list-inside list-disc text-sm">
          <li>Advanced analytics</li>
          <li>Priority support</li>
          <li>Custom integrations</li>
        </ul>
      </div>
    ),
    actions: (
      <>
        <Button variant="ghost" size="sm">
          Learn More
        </Button>
        <Button variant="primary" size="sm">
          Upgrade Now
        </Button>
      </>
    ),
  },
};

export const CardGrid: Story = {
  args: {
    children: 'Card content',
  },
  render: () => (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
      <Card title="Card 1" bordered>
        First card in the grid
      </Card>
      <Card title="Card 2" glass>
        Second card with glass effect
      </Card>
      <Card title="Card 3" compact>
        Third compact card
      </Card>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

export const ThemeShowcase: Story = {
  args: {
    children: 'Card content',
  },
  render: () => (
    <div className="bg-base-200 flex flex-col gap-6 p-6">
      <h3 className="text-base-content text-lg font-semibold">
        Card Styles on base-200
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Default Card">
          <p className="text-base-content/80">
            Standard card with shadow on the current theme surface.
          </p>
        </Card>
        <Card title="Bordered Card" bordered>
          <p className="text-base-content/80">
            Card with visible border for subtle separation.
          </p>
        </Card>
        <Card
          title="Card with Actions"
          actions={
            <>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
              <Button variant="primary" size="sm">
                Confirm
              </Button>
            </>
          }
        >
          <p className="text-base-content/80">
            Primary and ghost buttons on a card surface.
          </p>
        </Card>
        <Card
          title="Accent Card"
          actions={
            <Button variant="accent" size="sm">
              Learn More
            </Button>
          }
        >
          <p className="text-base-content/80">
            Card with accent action for call-to-action emphasis.
          </p>
        </Card>
      </div>
      <h3 className="text-base-content text-lg font-semibold">
        Card on neutral surface
      </h3>
      <div className="bg-neutral rounded-box grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Card title="On Neutral" bordered>
          <p className="text-base-content/80">
            Card elevated above a neutral background.
          </p>
        </Card>
        <Card
          title="Glass on Neutral"
          glass
          actions={
            <Button variant="secondary" size="sm">
              Action
            </Button>
          }
        >
          <p className="text-base-content/80">
            Glass effect shows the neutral surface beneath.
          </p>
        </Card>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

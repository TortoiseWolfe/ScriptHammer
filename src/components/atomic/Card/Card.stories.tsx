import type { Meta, StoryObj } from '@storybook/nextjs';
import { Card } from './Card';
import { Button } from '../Button/Button';

const meta = {
  title: 'Atomic Design/Atomic/Card',
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

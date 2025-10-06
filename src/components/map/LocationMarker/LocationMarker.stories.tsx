import type { Meta, StoryObj } from '@storybook/nextjs';
import { LocationMarker } from './LocationMarker';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const meta = {
  title: 'Features/Map/LocationMarker',
  component: LocationMarker,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '400px', width: '100%' }}>
        <MapContainer
          center={[51.505, -0.09]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Story />
        </MapContainer>
      </div>
    ),
  ],
  argTypes: {
    position: {
      control: 'object',
      description: 'Marker position [lat, lng]',
    },
    accuracy: {
      control: { type: 'range', min: 0, max: 500 },
      description: 'Location accuracy in meters',
    },
    showAccuracy: {
      control: 'boolean',
      description: 'Show accuracy circle',
    },
    popup: {
      control: 'text',
      description: 'Popup text content',
    },
    draggable: {
      control: 'boolean',
      description: 'Allow marker dragging',
    },
  },
} satisfies Meta<typeof LocationMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    position: [51.505, -0.09] as [number, number],
    accuracy: 50,
    showAccuracy: true,
  },
};

export const NoAccuracy: Story = {
  args: {
    position: [51.505, -0.09] as [number, number],
    showAccuracy: false,
  },
};

export const HighAccuracy: Story = {
  args: {
    position: [51.505, -0.09] as [number, number],
    accuracy: 10,
    showAccuracy: true,
  },
};

export const LowAccuracy: Story = {
  args: {
    position: [51.505, -0.09] as [number, number],
    accuracy: 200,
    showAccuracy: true,
  },
};

export const WithCustomPopup: Story = {
  args: {
    position: [51.505, -0.09] as [number, number],
    accuracy: 50,
    popup: 'You are here!',
  },
};

export const Draggable: Story = {
  args: {
    position: [51.505, -0.09] as [number, number],
    accuracy: 50,
    draggable: true,
    onDragEnd: (position) => console.log('New position:', position),
  },
};

export const MultipleAccuracyLevels: Story = {
  args: {
    position: [51.505, -0.09] as [number, number],
    accuracy: 50,
    showAccuracy: true,
  },
  render: (args) => (
    <>
      <LocationMarker
        {...args}
        position={[51.505, -0.09]}
        accuracy={20}
        showAccuracy={true}
      />
      <LocationMarker
        position={[51.51, -0.1]}
        accuracy={100}
        showAccuracy={true}
      />
      <LocationMarker
        position={[51.5, -0.08]}
        accuracy={300}
        showAccuracy={true}
      />
    </>
  ),
};

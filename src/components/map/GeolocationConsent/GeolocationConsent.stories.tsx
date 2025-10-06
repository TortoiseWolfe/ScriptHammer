import type { Meta, StoryObj } from '@storybook/nextjs';
import { GeolocationConsent, GeolocationPurpose } from './GeolocationConsent';

const meta = {
  title: 'Features/Map/GeolocationConsent',
  component: GeolocationConsent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Controls modal visibility',
    },
    onAccept: { action: 'accepted' },
    onDecline: { action: 'declined' },
    onClose: { action: 'closed' },
    title: {
      control: 'text',
      description: 'Modal title',
    },
    description: {
      control: 'text',
      description: 'Modal description',
    },
    required: {
      control: 'boolean',
      description: 'Whether consent is required',
    },
    privacyPolicyUrl: {
      control: 'text',
      description: 'Privacy policy link',
    },
  },
  args: {
    isOpen: true,
    onAccept: (purposes: GeolocationPurpose[]) =>
      console.log('Accepted:', purposes),
    onDecline: () => console.log('Declined'),
    onClose: () => console.log('Closed'),
  },
} satisfies Meta<typeof GeolocationConsent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
  },
};

export const Required: Story = {
  args: {
    isOpen: true,
    required: true,
  },
};

export const WithPrivacyPolicy: Story = {
  args: {
    isOpen: true,
    privacyPolicyUrl: '/privacy',
  },
};

export const CustomTitle: Story = {
  args: {
    isOpen: true,
    title: 'Enable Location Services',
    description: 'We need your location to show you nearby attractions.',
  },
};

export const LimitedPurposes: Story = {
  args: {
    isOpen: true,
    purposes: [
      GeolocationPurpose.USER_LOCATION_DISPLAY,
      GeolocationPurpose.NEARBY_SEARCH,
    ],
  },
};

export const SinglePurpose: Story = {
  args: {
    isOpen: true,
    purposes: [GeolocationPurpose.USER_LOCATION_DISPLAY],
    description: 'We only need your location to show you on the map.',
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const LongDescription: Story = {
  args: {
    isOpen: true,
    description:
      'This application uses your location data to provide you with a personalized experience. Your location helps us show you on the map, find nearby points of interest, provide relevant search results, and improve our services. We take your privacy seriously and only use your location when necessary.',
  },
};

export const AllFeatures: Story = {
  args: {
    isOpen: true,
    title: 'Location Permission Request',
    description:
      'To provide the best experience, we need access to your location.',
    required: false,
    privacyPolicyUrl: '/privacy-policy',
    purposes: [
      GeolocationPurpose.USER_LOCATION_DISPLAY,
      GeolocationPurpose.NEARBY_SEARCH,
      GeolocationPurpose.LOCATION_ANALYTICS,
      GeolocationPurpose.PERSONALIZATION,
    ],
  },
};

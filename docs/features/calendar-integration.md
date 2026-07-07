# Calendar Integration

The CRUDkit template includes built-in calendar scheduling integration supporting both Calendly and Cal.com.

## Features

- **Multiple Provider Support**: Choose between Calendly or Cal.com
- **Theme Integration**: Automatically adapts to your current theme (light/dark mode)
- **GDPR Compliance**: Requires user consent before loading third-party content
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Two Display Modes**:
  - Inline: Embeds the calendar directly on the page
  - Popup: Shows a button that opens the calendar in a modal

## Setup

### 1. Choose Your Provider

#### Calendly

1. Create a free account at [calendly.com](https://calendly.com)
2. Set up your event types and availability
3. Get your scheduling link from your dashboard

#### Cal.com

1. Create a free account at [cal.com](https://cal.com)
2. Configure your availability and booking settings
3. Get your booking link from your dashboard

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# For Calendly
NEXT_PUBLIC_CALENDAR_PROVIDER=calendly
NEXT_PUBLIC_CALENDAR_URL=https://calendly.com/your-username/30min

# OR for Cal.com
NEXT_PUBLIC_CALENDAR_PROVIDER=calcom
NEXT_PUBLIC_CALENDAR_URL=your-username/meeting
```

### 3. Access the Calendar

Navigate to `/schedule` to see your calendar integration in action.

## Usage in Your Components

### Basic Usage

```tsx
import CalendarEmbed from '@/components/atomic/CalendarEmbed';

function MyComponent() {
  return <CalendarEmbed mode="inline" />;
}
```

### With Prefilled Data

```tsx
<CalendarEmbed
  mode="inline"
  prefill={{
    name: 'John Doe',
    email: 'john@example.com',
  }}
/>
```

### Popup Mode

```tsx
<CalendarEmbed mode="popup" />
```

### Custom Provider

```tsx
<CalendarEmbed provider="calcom" url="custom-user/custom-event" />
```

## Component Structure

The calendar integration follows the atomic design pattern:

```
src/components/
├── atomic/
│   └── CalendarEmbed/          # Main calendar component
│       ├── index.tsx
│       ├── CalendarEmbed.tsx
│       ├── CalendarEmbed.test.tsx
│       ├── CalendarEmbed.stories.tsx
│       └── CalendarEmbed.accessibility.test.tsx
└── calendar/
    ├── providers/
    │   ├── CalendlyProvider.tsx  # Calendly-specific logic
    │   └── CalComProvider.tsx    # Cal.com-specific logic
    └── CalendarConsent.tsx        # GDPR consent component
```

## Consent Management

The calendar integration respects user privacy:

1. On first load, users see a consent prompt
2. Calendar only loads after explicit consent
3. Consent is stored in localStorage
4. Users can revoke consent in Privacy Settings

## Theming

The calendar automatically adapts to your current theme:

- Detects light/dark mode
- Passes theme colors to the calendar provider
- Maintains visual consistency with your app

## Analytics

When implemented with analytics, the calendar tracks:

- Calendar views
- Time slot selections
- Successful bookings

## Testing

Run tests with:

```bash
# All calendar tests
pnpm test src/components/atomic/CalendarEmbed

# Unit tests only
pnpm test CalendarEmbed.test.tsx

# Accessibility tests
pnpm test CalendarEmbed.accessibility.test.tsx
```

## Troubleshooting

### Calendar Not Showing

- Verify environment variables are set correctly
- Check browser console for errors
- Ensure user has granted consent

### Theme Not Applying

- Calendar providers may cache styles
- Try refreshing the page
- Check if theme is properly set in DOM

### Popup Mode Issues

- Ensure popups are not blocked by browser
- Check that the page is served over HTTPS in production

## Security Considerations

- Calendar URLs are public - don't include sensitive information
- Use environment variables for configuration
- Implement rate limiting on your calendar provider
- Review privacy policies of your chosen provider

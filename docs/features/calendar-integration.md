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

For local development, add the following to your `.env.local`:

```bash
# For Calendly
NEXT_PUBLIC_CALENDAR_PROVIDER=calendly
NEXT_PUBLIC_CALENDAR_URL=https://calendly.com/your-username/30min

# OR for Cal.com — note this is a FULL URL, not a bare user/event slug
NEXT_PUBLIC_CALENDAR_PROVIDER=calcom
NEXT_PUBLIC_CALENDAR_URL=https://cal.com/your-username/meeting
```

**Always a full URL, for both providers.** The embed wants a bare `user/event` path and gets
one — `toCalLink` derives it (#1100). But the same configured value is also used to build the
outbound booking link shown after a purchase, and that builder calls `new URL()` and returns
`null` when it throws. Configure the bare form and `/schedule` still works, so the page you
check looks fine while the link a paying customer needs silently disappears.

**For a deployed site, `.env.local` is not enough.** `NEXT_PUBLIC_*` is inlined at build time,
so the value has to reach the build — which means a repository **Variable**
(Settings → Secrets and variables → Actions → _Variables_), not a Secret and not a local file.
`deploy.yml` reads `vars.NEXT_PUBLIC_CALENDAR_PROVIDER`, `vars.NEXT_PUBLIC_CALENDAR_URL` and
`vars.NEXT_PUBLIC_CALENDAR_URL_OFFICE_HOURS`. Put them in Secrets and they arrive as empty
strings, the deploy goes green, and the site ships with no scheduler.

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

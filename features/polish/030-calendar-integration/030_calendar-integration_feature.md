# Feature: Calendar Integration (Calendly/Cal.com)

**Feature ID**: 030
**Category**: polish
**Source**: ScriptHammer/docs/specs/013-calendar-integration
**Status**: Ready for SpecKit

## Description

A calendar scheduling integration that embeds Calendly or Cal.com into the application for appointment booking. Supports both providers with a clean abstraction layer, responsive embed design, theme-aware styling, and GDPR-compliant consent flow.

## User Scenarios

### US-1: Book Appointment (P1)

A visitor views the calendar and books an appointment through the embedded scheduler.

**Acceptance Criteria**:

1. Given /schedule page, when loaded, then calendar embed displays
2. Given time slot selected, when confirmed, then booking is created
3. Given booking complete, when finished, then confirmation shown

### US-2: Consent-Gated Calendar (P1)

Calendar only loads after user grants functional consent (GDPR compliance).

**Acceptance Criteria**:

1. Given no consent, when page loads, then consent prompt shown instead of calendar
2. Given consent granted, when accepted, then calendar embed loads
3. Given consent revoked, when page revisited, then consent prompt shown again

### US-3: Theme-Aware Styling (P2)

Calendar embed adapts to match the application's current theme.

**Acceptance Criteria**:

1. Given dark theme active, when calendar loads, then dark colors applied
2. Given theme switched, when calendar visible, then colors update
3. Given any of 32 themes, when calendar displayed, then styling is harmonious

### US-4: Provider Abstraction (P2)

System supports both Calendly and Cal.com through environment configuration.

**Acceptance Criteria**:

1. Given CALENDAR_PROVIDER=calendly, when page loads, then Calendly embed shown
2. Given CALENDAR_PROVIDER=calcom, when page loads, then Cal.com embed shown
3. Given provider switched, when redeployed, then correct provider loads

### US-5: Analytics Tracking (P3)

Calendar events are tracked for analytics.

**Acceptance Criteria**:

1. Given calendar viewed, when event fires, then "calendar_viewed" tracked
2. Given time selected, when event fires, then "calendar_time_selected" tracked
3. Given booking complete, when event fires, then "calendar_scheduled" tracked

## Requirements

### Functional

- FR-001: Calendar embed renders responsively
- FR-002: Both Calendly and Cal.com supported via abstraction
- FR-003: Custom styling matches app theme (dark/light)
- FR-004: Event types configurable via environment
- FR-005: UTM tracking for analytics attribution
- FR-006: Fallback for unsupported browsers
- FR-007: GDPR compliant (consent required before loading)
- FR-008: Accessibility standards met (WCAG AA)
- FR-009: Works across all 32 themes
- FR-010: Supports inline and popup modes

### Non-Functional

- NFR-001: Calendar loads within 2 seconds after consent
- NFR-002: No layout shift during embed load
- NFR-003: Bundle size impact < 15KB
- NFR-004: Works in all modern browsers

### Components

- **CalendarEmbed**: Main component with consent check
- **CalendlyProvider**: Calendly-specific implementation
- **CalComProvider**: Cal.com-specific implementation
- **CalendarConsent**: Consent prompt component

### Configuration

```env
NEXT_PUBLIC_CALENDAR_PROVIDER=calendly  # or 'calcom'
NEXT_PUBLIC_CALENDAR_URL=https://calendly.com/username/event
```

### Dependencies

```bash
# For Calendly
pnpm add react-calendly

# For Cal.com
pnpm add @calcom/embed-react
```

### OAuth Flow (Cal.com Only)

Cal.com supports OAuth for deeper integration (reading/writing bookings). This is optional and only needed if you want to:

- Display user's bookings in your app
- Programmatically create/cancel bookings
- Sync with external calendars

**OAuth Configuration** (Cal.com):

```env
# Only needed for OAuth integration (optional)
CALCOM_CLIENT_ID=your_client_id
CALCOM_CLIENT_SECRET=your_client_secret  # Server-side only
```

**OAuth Flow** (if using):

```typescript
// 1. Redirect to Cal.com authorization
const authUrl = `https://app.cal.com/auth/oauth?client_id=${CALCOM_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;

// 2. Handle callback via Edge Function (secrets server-side only)
// supabase/functions/calcom-oauth/index.ts
serve(async (req) => {
  const code = new URL(req.url).searchParams.get('code');
  const tokenRes = await fetch('https://api.cal.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('CALCOM_CLIENT_ID'),
      client_secret: Deno.env.get('CALCOM_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
    }),
  });
  // Store tokens securely, redirect user
});
```

**Note**: Basic embed (US-1) does NOT require OAuth - only public embed URL needed. OAuth is only for advanced booking management features.

### Out of Scope

- Custom calendar backend
- Direct calendar API integration
- Multi-calendar sync
- Payment processing (use provider's features)
- Custom availability rules

## Success Criteria

- SC-001: Calendar embed renders responsively on all viewports
- SC-002: Both Calendly and Cal.com work through abstraction
- SC-003: Theme-aware styling matches current theme
- SC-004: Consent required before loading third-party scripts
- SC-005: Analytics events tracked correctly
- SC-006: All 32 themes display calendar harmoniously
- SC-007: Accessibility audit passes (WCAG AA)

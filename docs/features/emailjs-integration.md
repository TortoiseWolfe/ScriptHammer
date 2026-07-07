# EmailJS Integration Documentation

## Overview

EmailJS has been integrated as a backup email provider for the CRUDkit contact form, providing automatic failover when the primary provider (Web3Forms) is unavailable. This creates a robust, redundant email system with zero downtime.

## Architecture

### Provider Pattern

The email system uses a provider pattern with the following structure:

```
src/utils/email/
├── types.ts                 # TypeScript interfaces
├── email-service.ts         # Orchestration layer
└── providers/
    ├── web3forms.ts        # Primary provider (Priority 1)
    └── emailjs.ts          # Backup provider (Priority 2)
```

### Key Features

- **Automatic Failover**: If Web3Forms fails, EmailJS takes over seamlessly
- **Retry Logic**: Each provider retries with exponential backoff (2 retries by default)
- **Rate Limiting**: 10 requests per minute across all providers
- **Health Tracking**: Providers with too many failures are temporarily skipped
- **Transparent to Users**: Form works the same regardless of which provider is used

## Setup Instructions

### 1. Create EmailJS Account

1. Sign up at [https://www.emailjs.com/](https://www.emailjs.com/)
2. Verify your email address

### 2. Configure Email Service

1. In EmailJS dashboard, click "Email Services"
2. Click "Add New Service"
3. Select your email provider (Gmail, Outlook, etc.)
4. Follow the authorization steps
5. Save the Service ID

### 3. Create Email Template

1. Click "Email Templates"
2. Click "Create New Template"
3. Configure the template:

```
Subject: {{subject}}

From: {{from_name}} ({{from_email}})

Message:
{{message}}

---
Sent from CRUDkit Contact Form
Reply to: {{reply_to}}
```

4. Set the "To Email" to your recipient address
5. Save and note the Template ID

### 4. Get API Keys

1. Go to "Integration" → "API Keys"
2. Copy your Public Key

### 5. Configure Environment Variables

Add to `.env.local`:

```bash
# EmailJS Configuration (Backup Email Provider)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=service_xxxxxxx
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=template_xxxxxxx
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxx
```

## Usage

The email service is automatically used by the contact form. No code changes required.

### How It Works

1. User submits contact form
2. Email service attempts to send via Web3Forms (primary)
3. If Web3Forms fails after retries, automatically tries EmailJS
4. Success message indicates which provider was used (in dev mode)

### Testing Failover

To test the failover mechanism:

1. Temporarily set invalid Web3Forms key in `.env.local`
2. Submit the contact form
3. Check console logs to see failover to EmailJS
4. Email should still be delivered via backup provider

## API Reference

### EmailService Methods

```typescript
// Send email with automatic failover
await emailService.send(data: ContactFormData)

// Check provider status
await emailService.getStatus()

// Get rate limit status
emailService.getRateLimitStatus()

// Reset provider failures
emailService.resetProviderFailures('EmailJS')
```

### Provider Interface

Each provider implements:

```typescript
interface EmailProvider {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  send(data: ContactFormData): Promise<EmailResult>;
  validateConfig(): Promise<boolean>;
}
```

## Configuration Options

### Email Service Config

```typescript
const emailService = new EmailService({
  config: {
    maxRetries: 2, // Retries per provider
    baseDelay: 1000, // Initial retry delay (ms)
    maxFailures: 3, // Failures before provider is skipped
  },
});
```

### Rate Limiting

Default: 10 requests per minute

To modify, edit `RATE_LIMIT_CONFIG` in `email-service.ts`:

```typescript
const RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
};
```

## Monitoring & Debugging

### Console Logs

The service logs all attempts and failures:

```
[EmailService] Attempting to send via Web3Forms
[EmailService] Web3Forms failed: Network error
[EmailService] Retrying Web3Forms in 1000ms... (2 retries left)
[EmailService] Attempting to send via EmailJS
[EmailService] Successfully sent via EmailJS
```

### Provider Status

Check provider health:

```typescript
const statuses = await emailService.getStatus();
// Returns array of ProviderStatus objects with health info
```

### Common Issues

1. **EmailJS not sending**: Verify all three environment variables are set correctly
2. **Rate limit errors**: Check `getRateLimitStatus()` for remaining requests
3. **Both providers fail**: Check network connection and API keys

## Testing

### Unit Tests

Run provider tests:

```bash
docker compose exec scripthammer pnpm test src/utils/email/
```

### Integration Tests

The contact form tests automatically verify email integration:

```bash
docker compose exec scripthammer pnpm test src/components/forms/ContactForm/
```

## Security Considerations

- Both Web3Forms and EmailJS use public API keys designed for client-side use
- No sensitive data is exposed
- Rate limiting prevents abuse
- Form validation prevents spam

## Performance

- Average email send time: 200-500ms
- Failover adds: ~3 seconds (with retries)
- No impact on page load or user experience
- Background sync for offline submissions

## Future Enhancements

- [ ] Add more providers (SendGrid, Mailgun)
- [ ] Implement provider rotation for load balancing
- [ ] Add email delivery tracking
- [ ] Create admin dashboard for monitoring
- [ ] Implement custom retry strategies per provider

## Troubleshooting

### Provider Not Available

```bash
# Check if EmailJS is configured
grep EMAILJS .env.local

# Verify not using placeholder values
# Should NOT see: service_placeholder, template_placeholder
```

### Test Email Delivery

```typescript
// In browser console (dev mode)
const { emailService } = await import('/src/utils/email/email-service');
const result = await emailService.send({
  name: 'Test User',
  email: 'test@example.com',
  subject: 'Test Subject',
  message: 'Test message',
});
console.log(result);
```

## Support

For issues with:

- **EmailJS Setup**: [EmailJS Documentation](https://www.emailjs.com/docs/)
- **Web3Forms**: [Web3Forms Documentation](https://web3forms.com/docs)
- **CRUDkit Integration**: Create issue in GitHub repository

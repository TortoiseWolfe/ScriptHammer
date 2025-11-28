# Product Requirements Prompt (PRP)

**Feature Name**: EmailJS Integration  
**Priority**: P1 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A backup email service integration using EmailJS that provides redundancy for Web3Forms. This will implement a fallback pattern where if the primary provider (Web3Forms) fails, EmailJS automatically takes over, ensuring zero message loss.

### Why We're Building It

- Constitutional requirement (Section 6, Phase 2: EmailJS Integration)
- Provides redundancy for critical contact forms
- Zero-downtime email delivery
- No server-side email configuration needed
- Demonstrates failover patterns

### Success Criteria

- [ ] EmailJS configured as backup provider
- [ ] Automatic failover when Web3Forms fails
- [ ] Retry logic with exponential backoff
- [ ] Success/failure tracking for both providers
- [ ] User unaware of provider switching
- [ ] Email templates match between providers
- [ ] Rate limiting respected for both services
- [ ] Error logging for debugging

### Out of Scope

- Custom SMTP server integration
- Email tracking/analytics
- Bulk email sending
- Email scheduling
- Rich HTML templates

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Web3Forms Implementation (Primary)

```typescript
// From Web3Forms PRP
// src/utils/web3forms.ts
export async function submitToWeb3Forms(data: ContactFormData) {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      access_key: process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Web3Forms error: ${response.status}`);
  }

  return response.json();
}
```

#### Form Validation with Zod

```typescript
// src/schemas/contact.schema.ts
export const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.string().min(5).max(200),
  message: z.string().min(10).max(5000),
});
```

#### Error Handling Pattern

```typescript
// Existing retry logic pattern
const retry = async (fn: Function, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((r) => setTimeout(r, delay));
    return retry(fn, retries - 1, delay * 2);
  }
};
```

### Dependencies & Libraries

```bash
# EmailJS SDK
pnpm add @emailjs/browser

# Already installed
# react-hook-form, zod, @hookform/resolvers
```

### File Structure

```
src/
├── utils/
│   ├── email/
│   │   ├── providers/
│   │   │   ├── web3forms.ts      # Primary provider
│   │   │   └── emailjs.ts        # Backup provider
│   │   ├── email-service.ts      # Orchestration layer
│   │   └── types.ts              # Shared types
│   └── web3forms.ts              # UPDATE: Move to providers/
├── hooks/
│   └── useEmailService.ts        # React hook for email
└── config/
    └── email.config.ts           # Provider configuration
```

---

## 3. Technical Specifications

### EmailJS Provider Implementation

```typescript
// src/utils/email/providers/emailjs.ts
import emailjs from '@emailjs/browser';
import { ContactFormData, EmailProvider, EmailResult } from '../types';

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!;
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;

export class EmailJSProvider implements EmailProvider {
  name = 'EmailJS';
  priority = 2; // Backup provider

  async isAvailable(): Promise<boolean> {
    return Boolean(
      EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY
    );
  }

  async send(data: ContactFormData): Promise<EmailResult> {
    try {
      // Initialize EmailJS
      emailjs.init(EMAILJS_PUBLIC_KEY);

      // Map data to EmailJS template format
      const templateParams = {
        from_name: data.name,
        from_email: data.email,
        subject: data.subject,
        message: data.message,
        to_name: 'CRUDkit Team',
        reply_to: data.email,
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );

      return {
        success: response.status === 200,
        provider: this.name,
        messageId: response.text,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('EmailJS error:', error);
      throw new Error(`EmailJS failed: ${error.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Test connection with a minimal request
      emailjs.init(EMAILJS_PUBLIC_KEY);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Email Service Orchestrator

```typescript
// src/utils/email/email-service.ts
import { Web3FormsProvider } from './providers/web3forms';
import { EmailJSProvider } from './providers/emailjs';
import { ContactFormData, EmailProvider, EmailResult } from './types';

export class EmailService {
  private providers: EmailProvider[] = [];
  private failureLog: Map<string, number> = new Map();

  constructor() {
    // Register providers in priority order
    this.providers = [
      new Web3FormsProvider(), // Priority 1
      new EmailJSProvider(), // Priority 2
    ];
  }

  async send(data: ContactFormData): Promise<EmailResult> {
    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No email providers available');
    }

    // Try each provider in order
    for (const provider of availableProviders) {
      try {
        console.log(`Attempting to send via ${provider.name}`);

        const result = await this.sendWithRetry(provider, data);

        // Reset failure count on success
        this.failureLog.delete(provider.name);

        return result;
      } catch (error) {
        console.error(`${provider.name} failed:`, error);

        // Track failures
        const failures = (this.failureLog.get(provider.name) || 0) + 1;
        this.failureLog.set(provider.name, failures);

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    throw new Error('All email providers failed. Please try again later.');
  }

  private async sendWithRetry(
    provider: EmailProvider,
    data: ContactFormData,
    retries = 2,
    delay = 1000
  ): Promise<EmailResult> {
    try {
      return await provider.send(data);
    } catch (error) {
      if (retries <= 0) throw error;

      console.log(`Retrying ${provider.name} in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.sendWithRetry(provider, data, retries - 1, delay * 2);
    }
  }

  private async getAvailableProviders(): Promise<EmailProvider[]> {
    const available = [];

    for (const provider of this.providers) {
      const isAvailable = await provider.isAvailable();
      const recentFailures = this.failureLog.get(provider.name) || 0;

      // Skip providers with too many recent failures
      if (isAvailable && recentFailures < 3) {
        available.push(provider);
      }
    }

    return available.sort((a, b) => a.priority - b.priority);
  }

  async getStatus() {
    const statuses = [];

    for (const provider of this.providers) {
      const available = await provider.isAvailable();
      const failures = this.failureLog.get(provider.name) || 0;

      statuses.push({
        name: provider.name,
        priority: provider.priority,
        available,
        failures,
        healthy: available && failures < 3,
      });
    }

    return statuses;
  }
}

// Singleton instance
export const emailService = new EmailService();
```

### React Hook

```typescript
// src/hooks/useEmailService.ts
import { useState } from 'react';
import { emailService } from '@/utils/email/email-service';
import { ContactFormData } from '@/schemas/contact.schema';

interface UseEmailServiceReturn {
  send: (data: ContactFormData) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: boolean;
  provider: string | null;
  reset: () => void;
}

export function useEmailService(): UseEmailServiceReturn {
  const [state, setState] = useState({
    loading: false,
    error: null as string | null,
    success: false,
    provider: null as string | null,
  });

  const send = async (data: ContactFormData) => {
    setState({ loading: true, error: null, success: false, provider: null });

    try {
      const result = await emailService.send(data);

      setState({
        loading: false,
        error: null,
        success: true,
        provider: result.provider,
      });
    } catch (error) {
      setState({
        loading: false,
        error: error.message,
        success: false,
        provider: null,
      });
      throw error;
    }
  };

  const reset = () => {
    setState({
      loading: false,
      error: null,
      success: false,
      provider: null,
    });
  };

  return {
    ...state,
    send,
    reset,
  };
}
```

### Contact Form Integration

```typescript
// src/components/forms/ContactForm/ContactForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema, ContactFormData } from '@/schemas/contact.schema';
import { useEmailService } from '@/hooks/useEmailService';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';

export default function ContactForm() {
  const { send, loading, error, success, provider, reset } = useEmailService();
  const { queueFormSubmission } = useBackgroundSync();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema)
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      if (!navigator.onLine) {
        // Queue for background sync if offline
        await queueFormSubmission(data);
        // Show offline message
        return;
      }

      await send(data);
      resetForm();
    } catch (error) {
      console.error('Form submission failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields */}

      {success && (
        <div className="alert alert-success">
          <span>Message sent successfully via {provider}!</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading}
      >
        {loading ? (
          <><span className="loading loading-spinner"></span> Sending...</>
        ) : (
          'Send Message'
        )}
      </button>
    </form>
  );
}
```

### Environment Configuration

```bash
# .env.local
# Web3Forms (Primary)
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_web3forms_key

# EmailJS (Backup)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
```

---

## 4. Implementation Runbook

### Step 1: Setup EmailJS Account

1. Create account at https://www.emailjs.com/
2. Create email service (Gmail, Outlook, etc.)
3. Create email template matching Web3Forms
4. Get Service ID, Template ID, and Public Key
5. Add to .env.local

### Step 2: Install Dependencies

```bash
pnpm add @emailjs/browser
```

### Step 3: Create Email Service Structure

```bash
# Create directories
mkdir -p src/utils/email/providers

# Create files
touch src/utils/email/types.ts
touch src/utils/email/providers/web3forms.ts
touch src/utils/email/providers/emailjs.ts
touch src/utils/email/email-service.ts
touch src/hooks/useEmailService.ts
```

### Step 4: Migrate Web3Forms

```bash
# Move existing Web3Forms utils to provider pattern
mv src/utils/web3forms.ts src/utils/email/providers/web3forms.ts
```

### Step 5: EmailJS Template Setup

```html
<!-- EmailJS Template -->
Subject: {{subject}} From: {{from_name}} ({{from_email}}) Message: {{message}}
--- Sent from CRUDkit Contact Form
```

### Step 6: Testing

- [ ] Web3Forms sends successfully
- [ ] EmailJS sends successfully
- [ ] Failover works when Web3Forms down
- [ ] Retry logic functions
- [ ] Offline queueing works
- [ ] Both providers respect rate limits

---

## 5. Validation Loops

### Pre-Implementation Checks

- [ ] EmailJS account created
- [ ] Template configured
- [ ] API keys obtained
- [ ] Web3Forms already working

### During Implementation

- [ ] Provider pattern clean
- [ ] Failover smooth
- [ ] Error messages clear
- [ ] Loading states correct

### Post-Implementation

- [ ] Both providers tested
- [ ] Failover verified
- [ ] Monitoring in place
- [ ] Documentation complete

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: API keys exposed in client
   **Mitigation**: Both services designed for public keys

2. **Risk**: Rate limiting hit
   **Mitigation**: Track usage, implement client-side throttling

3. **Risk**: Template mismatch between providers
   **Mitigation**: Standardize template format, test both

4. **Risk**: Both providers fail
   **Mitigation**: Queue for retry, show clear error message

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 6, Phase 2)
- Web3Forms PRP: `/docs/spec-kit/prp/inbox/web3forms-integration-prp.md`
- Contact Schema: `/src/schemas/contact.schema.ts`
- Background Sync: PWA implementation

### External Resources

- [EmailJS Documentation](https://www.emailjs.com/docs/)
- [EmailJS React Guide](https://www.emailjs.com/docs/examples/reactjs/)
- [Web3Forms Documentation](https://web3forms.com/docs)
- [Failover Pattern Guide](https://martinfowler.com/articles/patterns-of-distributed-systems/)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox → Processed)

- [ ] Specification generated
- [ ] Plan created
- [ ] Tasks broken down
- [ ] Implementation started
- [ ] Completed on: [PENDING]

---

<!--
PRP for EmailJS Integration
Generated from SpecKit constitution analysis
Provides email redundancy with automatic failover
-->

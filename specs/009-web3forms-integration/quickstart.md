# Quick Start Guide: Web3Forms Integration

## Overview

This guide helps you quickly set up and understand the Web3Forms contact form integration in CRUDkit. Follow these steps to get a working contact form with email submission capabilities.

## Prerequisites

Before starting, ensure you have:

- ✅ CRUDkit project set up with Docker Compose
- ✅ Web3Forms account (free at [web3forms.com](https://web3forms.com))
- ✅ Basic understanding of Next.js and React
- ✅ Consent system (PRP-007) implemented

## Step 1: Set Up Web3Forms Account

### Create Account

1. Visit [web3forms.com](https://web3forms.com)
2. Click "Get Started for Free"
3. Sign up with your email
4. Verify your email address

### Get Access Key

1. Log into your Web3Forms dashboard
2. Create a new form or use the default one
3. Copy your **Access Key** (it looks like: `a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6`)
4. Configure your form settings:
   - **From Name**: "CRUDkit Contact Form"
   - **Subject Prefix**: "[CRUDkit Contact]"
   - **Redirect URL**: Leave blank for JSON responses

## Step 2: Environment Configuration

### Add Environment Variable

```bash
# In your .env.local file
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your-access-key-here
```

### Update .env.example

```bash
# Add to .env.example for documentation
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_web3forms_access_key_here
```

### Verify Configuration

```bash
# Test that the key is loaded
docker compose exec scripthammer node -e "console.log(process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY)"
```

## Step 3: Generate Form Component

### Use Component Generator

```bash
# Generate the ContactForm component with proper structure
docker compose exec scripthammer pnpm run generate:component

# Follow the prompts:
# ? Component type: forms
# ? Component name: ContactForm
# ? Component path: forms/ContactForm
```

This creates the required 4-file structure:

```
src/components/forms/ContactForm/
├── index.tsx                    # Barrel export
├── ContactForm.tsx              # Main component
├── ContactForm.test.tsx         # Unit tests
└── ContactForm.stories.tsx      # Storybook documentation
```

## Step 4: Basic Implementation

### Create Contact Schema

```typescript
// src/schemas/contact.schema.ts
import { z } from 'zod';

export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),

  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254, 'Email address is too long'),

  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject must be less than 200 characters'),

  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters'),
});

export type ContactFormData = z.infer<typeof contactSchema>;
```

### Create Web3Forms Utility

```typescript
// src/utils/web3forms.ts
export interface Web3FormsResponse {
  success: boolean;
  message: string;
}

export const submitToWeb3Forms = async (
  data: ContactFormData
): Promise<Web3FormsResponse> => {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      access_key: process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY,
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      from_name: 'CRUDkit Contact Form',
    }),
  });

  return response.json();
};
```

### Create Contact Form Hook

```typescript
// src/hooks/useWeb3Forms.ts
import { useState } from 'react';
import { ContactFormData } from '@/schemas/contact.schema';
import { submitToWeb3Forms } from '@/utils/web3forms';

export const useWeb3Forms = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitForm = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await submitToWeb3Forms(data);

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setIsSubmitting(false);
    setIsSuccess(false);
    setError(null);
  };

  return { submitForm, isSubmitting, isSuccess, error, reset };
};
```

### Implement ContactForm Component

```typescript
// src/components/forms/ContactForm/ContactForm.tsx
import React from 'react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useWeb3Forms } from '@/hooks/useWeb3Forms';
import { contactSchema, ContactFormData } from '@/schemas/contact.schema';
import { FormField, getFormFieldInputProps } from '@/components/forms/FormField';

export const ContactForm: React.FC = () => {
  const validation = useFormValidation(contactSchema);
  const { submitForm, isSubmitting, isSuccess, error, reset } = useWeb3Forms();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const data: ContactFormData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      subject: formData.get('subject') as string,
      message: formData.get('message') as string,
    };

    // Validate before submission
    await validation.validateForm(data);

    if (validation.isValid) {
      await submitForm(data);
    }
  };

  if (isSuccess) {
    return (
      <div className="alert alert-success">
        <p>Thank you! Your message has been sent successfully.</p>
        <button className="btn btn-primary" onClick={reset}>
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField
        label="Full Name"
        name="name"
        required
        error={validation.getFieldError('name')}
      >
        <input
          {...getFormFieldInputProps({
            name: 'name',
            error: validation.getFieldError('name'),
            required: true,
            className: 'input input-bordered w-full',
          })}
          type="text"
          placeholder="Enter your full name"
          onBlur={validation.handleBlur('name')}
        />
      </FormField>

      <FormField
        label="Email Address"
        name="email"
        required
        error={validation.getFieldError('email')}
      >
        <input
          {...getFormFieldInputProps({
            name: 'email',
            error: validation.getFieldError('email'),
            required: true,
            className: 'input input-bordered w-full',
          })}
          type="email"
          placeholder="Enter your email address"
          onBlur={validation.handleBlur('email')}
        />
      </FormField>

      <FormField
        label="Subject"
        name="subject"
        required
        error={validation.getFieldError('subject')}
      >
        <input
          {...getFormFieldInputProps({
            name: 'subject',
            error: validation.getFieldError('subject'),
            required: true,
            className: 'input input-bordered w-full',
          })}
          type="text"
          placeholder="Brief description of your inquiry"
          onBlur={validation.handleBlur('subject')}
        />
      </FormField>

      <FormField
        label="Message"
        name="message"
        required
        error={validation.getFieldError('message')}
      >
        <textarea
          {...getFormFieldInputProps({
            name: 'message',
            error: validation.getFieldError('message'),
            required: true,
            className: 'textarea textarea-bordered w-full',
          })}
          rows={6}
          placeholder="Enter your message here..."
          onBlur={validation.handleBlur('message')}
        />
      </FormField>

      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !validation.isValid}
        className={`btn btn-primary w-full ${isSubmitting ? 'loading' : ''}`}
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
};
```

## Step 5: Create Contact Page

### Add Contact Route

```typescript
// src/app/contact/page.tsx
import { Metadata } from 'next';
import { ContactForm } from '@/components/forms/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us | CRUDkit',
  description: 'Get in touch with the CRUDkit team',
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Contact Us</h1>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <p className="text-base-content/70 mb-6">
              Have a question or feedback? We'd love to hear from you.
              Send us a message and we'll respond as soon as possible.
            </p>

            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Add Navigation Link

```typescript
// Add to your navigation component
<Link href="/contact" className="btn btn-ghost">
  Contact
</Link>
```

## Step 6: Test Your Implementation

### Manual Testing

1. **Start Development Server**

   ```bash
   docker compose up
   ```

2. **Navigate to Contact Form**
   - Visit `http://localhost:3000/contact`
   - Form should render without errors

3. **Test Validation**
   - Try submitting empty form (should show validation errors)
   - Enter invalid email (should show email error)
   - Enter valid data progressively

4. **Test Submission**
   - Fill out form with valid data
   - Submit form
   - Check your email for the message
   - Verify success message displays

### Automated Testing

```bash
# Run component tests
docker compose exec scripthammer pnpm test ContactForm

# Run all form-related tests
docker compose exec scripthammer pnpm test -- --testPathPattern=forms

# Check coverage
docker compose exec scripthammer pnpm test:coverage
```

## Step 7: Production Deployment

### Environment Variables

```bash
# In your production environment
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your-production-access-key
```

### Build Verification

```bash
# Test production build
docker compose exec scripthammer pnpm run build

# Check for any build errors
docker compose exec scripthammer pnpm run start
```

## Troubleshooting

### Common Issues

#### 1. "Missing access key" Error

**Problem**: Form submission fails with missing access key
**Solution**:

- Check `.env.local` file exists and has correct key
- Restart development server after adding environment variables
- Verify key starts with `NEXT_PUBLIC_` prefix

#### 2. CORS Errors

**Problem**: Browser blocks Web3Forms API requests
**Solution**:

- Web3Forms allows all origins by default
- Check network tab for actual error message
- Verify API endpoint URL is correct

#### 3. Form Not Submitting

**Problem**: Form submits but nothing happens
**Solution**:

- Check browser console for JavaScript errors
- Verify form validation is passing
- Test with minimal form data first

#### 4. Email Not Received

**Problem**: Form submits successfully but no email arrives
**Solution**:

- Check spam/junk folder
- Verify Web3Forms dashboard shows submission
- Confirm email settings in Web3Forms account

### Debug Mode

```typescript
// Add debug logging to your hook
const submitForm = async (data: ContactFormData) => {
  console.log('Submitting form data:', data);

  try {
    const response = await submitToWeb3Forms(data);
    console.log('Web3Forms response:', response);

    // Rest of implementation...
  } catch (err) {
    console.error('Submission error:', err);
    // Error handling...
  }
};
```

### Performance Monitoring

```typescript
// Add performance tracking
const submitForm = async (data: ContactFormData) => {
  const startTime = performance.now();

  try {
    const response = await submitToWeb3Forms(data);
    const endTime = performance.now();

    console.log(`Form submission took ${endTime - startTime} milliseconds`);

    // Track with analytics if consent given
    if (canTrackAnalytics) {
      gtag('event', 'form_submission_time', {
        value: Math.round(endTime - startTime),
        event_category: 'performance',
      });
    }

    // Rest of implementation...
  } catch (err) {
    // Error handling...
  }
};
```

## Next Steps

After basic implementation:

1. **Add Advanced Features**
   - Offline form submission queue
   - Form draft auto-save
   - Enhanced spam protection
   - File attachment support

2. **Enhance User Experience**
   - Loading animations
   - Success/error toasts
   - Form progress indicators
   - Accessibility improvements

3. **Add Analytics**
   - Form interaction tracking
   - Conversion rate monitoring
   - Error rate analysis
   - Performance metrics

4. **Security Hardening**
   - Rate limiting implementation
   - Input sanitization enhancement
   - CSP header configuration
   - Bot detection improvements

## Resources

### Documentation

- [Web3Forms Docs](https://web3forms.com/docs)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [Next.js Forms](https://nextjs.org/docs/guides/building-forms)

### Support

- Web3Forms Support: [help@web3forms.com](mailto:help@web3forms.com)
- CRUDkit Issues: [GitHub Issues](https://github.com/tortoisewolfe/CRUDkit/issues)

---

Quick Start completed: 2025-09-15
PRP: 009-web3forms-integration
Ready for `/tasks` command execution

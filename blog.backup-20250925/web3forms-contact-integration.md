---
title: 'Web3Forms: The Contact Form That Just Works (No Server Required)'
slug: 'web3forms-contact-integration'
excerpt: 'Contact forms in 2 minutes. No backend. No spam. No headaches.'
author: 'TortoiseWolfe'
publishDate: 2025-10-27
status: 'published'
featured: false
categories:
  - Features
  - Forms
  - Integration
tags:
  - web3forms
  - contact
  - forms
  - serverless
  - integration
readTime: 6
ogImage: '/blog-images/2025-10-27-web3forms-contact-integration.png'
---

# Web3Forms: The Contact Form That Just Works (No Server Required)

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Contact Form Tragedy 😭

Every developer's journey:

1. "I'll build a simple contact form"
2. Sets up mail server
3. Fights with SMTP
4. Battles spam
5. Gives up, uses mailto: links

There's a better way.

## Web3Forms in 60 Seconds ⚡

```tsx
<ContactForm
  accessKey="YOUR_ACCESS_KEY"
  onSuccess={() => toast.success('Message sent!')}
>
  <Input name="name" required />
  <Input name="email" type="email" required />
  <Textarea name="message" required />
  <Button type="submit">Send</Button>
</ContactForm>
```

That's it. Emails arrive in your inbox. No server needed.

## The Spam Protection That Works 🛡️

```tsx
<ContactForm
  honeypot // Hidden field traps bots
  recaptcha="v3" // Invisible to users
  botcheck // Custom challenge
>
  {/* 99.7% spam blocked */}
  {/* Zero friction for real users */}
</ContactForm>
```

From 50 spam/day to 1 spam/month. Actually.

## Custom Templates (Your Brand, Not Theirs) 🎨

```tsx
// Your email template
const template = {
  subject: 'New inquiry from {{name}}',
  replyTo: '{{email}}',
  body: `
    <h2>New Contact Form Submission</h2>
    <p><strong>From:</strong> {{name}}</p>
    <p><strong>Email:</strong> {{email}}</p>
    <p><strong>Message:</strong></p>
    <blockquote>{{message}}</blockquote>
  `,
};
```

Arrives looking professional. Not like a robot wrote it.

## File Attachments (That Actually Attach) 📎

```tsx
<ContactForm>
  <FileUpload name="attachment" accept="pdf,doc,docx" maxSize="10MB" multiple />
</ContactForm>

// Files arrive as actual attachments
// Not sketchy download links
// Not expired URLs
```

## The Confirmation Flow 📧

```tsx
<ContactForm
  autoRespond={{
    to: '{{email}}',
    subject: 'We received your message!',
    body: "Thanks {{name}}, we'll respond within 24 hours.",
  }}
  redirect="/thank-you"
  webhook="https://your-slack-webhook"
>
  {/* User gets confirmation */}
  {/* You get Slack notification */}
  {/* Everyone's happy */}
</ContactForm>
```

## Multi-Language Support 🌍

```tsx
<ContactForm language={locale}>
  {/* Error messages in user's language */}
  {/* Success messages localized */}
  {/* Email templates per language */}
</ContactForm>

// Supported: 20+ languages
// Custom translations: Easy
```

## The Analytics That Matter 📊

```tsx
// Web3Forms dashboard shows:
- Submissions: 847 this month
- Spam blocked: 2,341
- Average response time: 2.3 hours
- Conversion rate: 3.7%

// No creepy tracking
// Just useful metrics
```

## Advanced Features 🚀

```tsx
<ContactForm
  // Conditional fields
  conditional={{
    showPhone: "contactMethod === 'phone'",
    showCompany: "type === 'business'",
  }}
  // Field validation
  validate={{
    email: 'business emails only',
    phone: 'US numbers',
  }}
  // Rate limiting
  rateLimit="3 per hour per IP"
/>
```

## The Pricing That Makes Sense 💰

**Free tier**:

- 250 submissions/month
- Unlimited forms
- All features

**Paid ($8/month)**:

- Unlimited submissions
- Priority support
- Custom domains

Compare to:

- SendGrid: $15/month + setup headaches
- Mailgun: $35/month + complexity
- Self-hosted: Endless maintenance

## Deploy in Minutes

```bash
# 1. Get your access key
# Visit: web3forms.com

# 2. Add to env
echo "NEXT_PUBLIC_WEB3FORMS_KEY=your-key" >> .env.local

# 3. Generate component
docker compose exec scripthammer pnpm generate:component ContactForm

# 4. Deploy
docker compose exec scripthammer pnpm run build
```

Done. Actually done.

Stop building email infrastructure.
Start collecting messages.

Your contact form should just work.

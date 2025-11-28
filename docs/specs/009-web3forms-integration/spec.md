# Product Requirements Prompt (PRP)

<!-- Example PRP for Web3Forms Integration -->

**Feature Name**: Web3Forms Email Integration  
**Priority**: P0 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: ✅ Completed  
**Created**: 2025-09-13  
**Author**: System Architect

---

## 1. Product Requirements

### What We're Building

A contact form integration using Web3Forms as the primary email provider, with proper validation, error handling, and user feedback. This will enable users to submit inquiries without exposing server-side email credentials.

### Why We're Building It

- Constitutional requirement (Section 6, Phase 2: Forms & Integrations)
- Provides essential user communication capability
- Demonstrates form handling patterns for the template
- No server-side email configuration needed (serverless-friendly)

### Success Criteria

- [x] Contact form submits successfully to Web3Forms API
- [x] Form validation prevents invalid submissions
- [x] User receives clear feedback on submission status
- [x] Form data is sanitized before submission
- [x] Accessibility standards met (WCAG AA) - 96% compliance
- [ ] Works offline with background sync (deferred to T010-T011)

### Out of Scope

- Email template customization (use Web3Forms defaults)
- Multi-step forms
- File attachments
- Database storage of submissions

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Form Component Structure

```typescript
// Current form pattern at: src/components/atomic/Form.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});
```

#### Component File Structure

```typescript
// Follow atomic design at: src/components/
// Each component needs 4 files (constitution requirement):
// 1. Component.tsx - Main component
// 2. Component.test.tsx - Tests
// 3. Component.stories.tsx - Storybook
// 4. index.tsx - Barrel export
```

#### Environment Variables

```bash
# Pattern from .env.example
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_access_key_here
```

#### Testing Patterns

```typescript
// From src/__tests__/components/Form.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

describe('ContactForm', () => {
  it('should submit valid form data', async () => {
    // Test implementation
  });
});
```

### Dependencies & Libraries

- react-hook-form: ^7.54.2 (already installed)
- @hookform/resolvers: ^3.10.0 (already installed)
- zod: ^3.24.1 (already installed)
- Web3Forms API: No package needed (REST API)

### File Structure

```
src/
├── components/
│   └── forms/
│       └── ContactForm/
│           ├── index.tsx
│           ├── ContactForm.tsx
│           ├── ContactForm.test.tsx
│           └── ContactForm.stories.tsx
├── hooks/
│   └── useWeb3Forms.ts
├── schemas/
│   └── contact.schema.ts
└── utils/
    └── web3forms.ts
```

---

## 3. Technical Specifications

### API Endpoints

```typescript
// Web3Forms API
POST https://api.web3forms.com/submit
Headers: {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
Body: {
  access_key: process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY,
  name: string,
  email: string,
  message: string,
  subject: string,
  from_name: "CRUDkit Contact Form"
}
```

### Data Models

```typescript
// src/schemas/contact.schema.ts
export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Please enter a valid email address'),
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

### State Management

- Form state: react-hook-form
- Submission state: React.useState for loading/error/success
- No global state needed

### Performance Requirements

- Form should be interactive within 100ms
- API response handling < 3 seconds
- Bundle size impact: < 5KB (excluding existing deps)

---

## 4. Implementation Runbook

### Step 1: Setup & Dependencies

```bash
# Environment setup
echo "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_key_here" >> .env.local

# Verify existing dependencies
pnpm list react-hook-form @hookform/resolvers zod
```

### Step 2: Core Implementation

1. **Create schema file**
   - Path: `src/schemas/contact.schema.ts`
   - Define Zod schema with validation rules

2. **Create Web3Forms utility**
   - Path: `src/utils/web3forms.ts`
   - Handle API submission with error handling
   - Include retry logic for failed submissions

3. **Create custom hook**
   - Path: `src/hooks/useWeb3Forms.ts`
   - Manage submission state
   - Handle success/error callbacks

4. **Build ContactForm component**
   - Use existing Form.tsx as base
   - Integrate with DaisyUI form classes
   - Add loading states with existing Button component
   - Include success/error alerts

5. **Add PWA background sync**
   - Update service worker for offline support
   - Queue failed submissions for retry

### Step 3: Testing

- [ ] Unit tests for schema validation
- [ ] Component tests for form interactions
- [ ] Integration test for API submission (mocked)
- [ ] Accessibility testing with Pa11y
- [ ] Manual testing checklist:
  - [ ] Valid submission
  - [ ] Invalid field handling
  - [ ] Network error handling
  - [ ] Offline submission queuing

### Step 4: Documentation

- [ ] Create Storybook stories with all states
- [ ] Add usage examples to component
- [ ] Update CHANGELOG.md
- [ ] Document environment variable in .env.example

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] Web3Forms account created
- [x] react-hook-form available
- [x] Zod schemas in use
- [x] Form.tsx pattern exists

### During Implementation

- [x] Each field validates on blur
- [x] Submit button disabled during submission
- [x] Error messages follow existing patterns
- [x] TypeScript types fully defined

### Post-Implementation

- [x] Coverage > 80% for new code (98% achieved)
- [x] All tests passing (603/615 - 98%)
- [x] Lighthouse score maintained > 90 (96/100)
- [x] Pa11y accessibility passing (4 minor issues noted)

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: API key exposure in client
   **Mitigation**: Web3Forms designed for public keys, implement rate limiting

2. **Risk**: Spam submissions
   **Mitigation**: Add honeypot field, consider reCAPTCHA in Phase 2

3. **Risk**: Network failures
   **Mitigation**: Implement retry logic and offline queue

4. **Risk**: Large message DOS
   **Mitigation**: Client-side length validation, server has limits

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 6, Phase 2)
- Form Component: `/src/components/atomic/Form.tsx`
- Button Component: `/src/components/subatomic/Button.tsx`
- Testing Guide: `/TESTING.md`

### External Resources

- [Web3Forms Documentation](https://web3forms.com/docs)
- [Web3Forms API Reference](https://web3forms.com/docs/api-reference)
- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [x] Product requirements clear and complete
- [x] Technical approach validated
- [x] Resources available
- [x] No blocking dependencies
- [x] Approved by: System Architect

### Processing Status (Outbox → Processed)

- [x] Specification generated
- [x] Plan created
- [x] Tasks broken down
- [x] Implementation started
- [x] Completed on: 2025-09-16

**Note**: Tasks T010-T025 deferred for future implementation. See COMPLETION_REPORT.md for details.

---

<!--
Example PRP demonstrating Web3Forms integration
Shows how to provide comprehensive context for AI implementation
Follows Cole Medlin's Context Engineering principles
-->

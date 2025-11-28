# PRP-009: Web3Forms Integration - Task List

## Overview

Implement serverless contact form integration using Web3Forms with comprehensive validation, error handling, and privacy-conscious analytics tracking.

**Approach**: Test-Driven Development (TDD) - Write tests first (RED), implement second (GREEN), refactor if needed.

**Timeline**: 10-12 hours (1.5 days)

---

## Task Tracking

| Task ID | Description                               | Status         | Priority        | Estimated Time |
| ------- | ----------------------------------------- | -------------- | --------------- | -------------- |
| T001    | Create form schema and type definitions   | ⬜ Not Started | P0 Critical     | 30 min         |
| T002    | Write tests for Web3Forms utilities       | ⬜ Not Started | P0 Critical     | 45 min         |
| T003    | Implement Web3Forms utility functions     | ⬜ Not Started | P0 Critical     | 45 min         |
| T004    | Write tests for useWeb3Forms hook         | ⬜ Not Started | P0 Critical     | 30 min         |
| T005    | Implement useWeb3Forms custom hook        | ⬜ Not Started | P0 Critical     | 45 min         |
| T006    | Generate ContactForm component structure  | ⬜ Not Started | P0 Critical     | 5 min          |
| T007    | Write tests for ContactForm component     | ⬜ Not Started | P0 Critical     | 45 min         |
| T008    | Implement ContactForm component           | ⬜ Not Started | P0 Critical     | 1 hour         |
| T009    | Create contact page and routing           | ⬜ Not Started | P0 Critical     | 30 min         |
| T010    | Implement offline submission queue        | ⬜ Not Started | P1 Important    | 45 min         |
| T011    | Update Service Worker for background sync | ⬜ Not Started | P1 Important    | 30 min         |
| T012    | Write tests for form validation           | ⬜ Not Started | P0 Critical     | 30 min         |
| T013    | Implement client-side rate limiting       | ⬜ Not Started | P1 Important    | 30 min         |
| T014    | Add spam protection (honeypot)            | ⬜ Not Started | P1 Important    | 20 min         |
| T015    | Integrate with consent system             | ⬜ Not Started | P0 Critical     | 30 min         |
| T016    | Implement form analytics tracking         | ⬜ Not Started | P1 Important    | 30 min         |
| T017    | Add form draft auto-save feature          | ⬜ Not Started | P2 Nice to have | 45 min         |
| T018    | Write integration tests                   | ⬜ Not Started | P0 Critical     | 45 min         |
| T019    | Write accessibility tests                 | ⬜ Not Started | P0 Critical     | 30 min         |
| T020    | Update Storybook stories                  | ⬜ Not Started | P1 Important    | 20 min         |
| T021    | Create error handling documentation       | ⬜ Not Started | P1 Important    | 30 min         |
| T022    | Update CSP headers for Web3Forms          | ⬜ Not Started | P0 Critical     | 15 min         |
| T023    | Create contact form usage guide           | ⬜ Not Started | P2 Nice to have | 30 min         |
| T024    | Performance testing and optimization      | ⬜ Not Started | P1 Important    | 30 min         |
| T025    | Update project documentation              | ⬜ Not Started | P1 Important    | 20 min         |

**Total Estimated Time**: ~11.5 hours

---

## Phase 1: Core Infrastructure (T001-T005)

### T001: Create form schema and type definitions

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 30 min

**File**: `src/schemas/contact.schema.ts`

**Acceptance Criteria**:

- [ ] Define contactSchema with Zod validation
- [ ] Create ContactFormData TypeScript interface
- [ ] Add Web3FormsSubmission interface
- [ ] Implement input sanitization transforms
- [ ] Export all types for reuse
- [ ] Add validation error messages

**Test First**:

```typescript
// src/schemas/contact.schema.test.ts
import { contactSchema, ContactFormData } from './contact.schema';

describe('Contact Schema', () => {
  it('should validate valid form data', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough content.',
    };
    expect(() => contactSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid email', () => {
    const invalidData = { email: 'invalid-email' };
    expect(() => contactSchema.parse(invalidData)).toThrow();
  });
});
```

---

### T002: Write tests for Web3Forms utilities

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 45 min

**File**: `src/utils/web3forms.test.ts`

**Test Cases**:

- `submitToWeb3Forms()` sends correct API request
- `validateFormData()` sanitizes input properly
- `createSubmissionPayload()` formats data correctly
- Error handling for network failures
- Retry logic with exponential backoff
- Rate limiting protection

**Test First**:

```typescript
describe('Web3Forms Utilities', () => {
  it('should submit form data successfully', async () => {
    const mockResponse = { success: true, message: 'Email sent' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await submitToWeb3Forms(validFormData);
    expect(result.success).toBe(true);
  });

  it('should retry on network error', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    const result = await submitToWeb3Forms(validFormData);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
```

---

### T003: Implement Web3Forms utility functions

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 45 min

**File**: `src/utils/web3forms.ts`

**Functions to Implement**:

- `submitToWeb3Forms()`: Core submission with retry logic
- `validateFormData()`: Client-side validation and sanitization
- `createSubmissionPayload()`: Format data for Web3Forms API
- `handleSubmissionError()`: Error categorization and messages
- `checkRateLimit()`: Client-side rate limiting

**Validation**:

- [x] All tests from T002 pass (GREEN)
- [x] No TypeScript errors
- [x] Proper error handling implemented

---

### T004: Write tests for useWeb3Forms hook

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 30 min

**File**: `src/hooks/useWeb3Forms.test.ts`

**Test Cases**:

- Hook returns correct initial state
- `submitForm()` updates loading state
- Success state updates correctly
- Error state includes proper error details
- Reset function clears state
- Integration with useFormValidation

**Test First**:

```typescript
describe('useWeb3Forms Hook', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useWeb3Forms());

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.isSubmitting).toBe(false);
    expect(result.current.state.error).toBeNull();
  });

  it('should handle successful submission', async () => {
    const { result } = renderHook(() => useWeb3Forms());

    await act(async () => {
      await result.current.submitForm(validFormData);
    });

    expect(result.current.state.isSuccess).toBe(true);
  });
});
```

---

### T005: Implement useWeb3Forms custom hook

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 45 min

**File**: `src/hooks/useWeb3Forms.ts`

**Hook Features**:

- Form submission state management
- Integration with form validation
- Error handling and retry logic
- Success/error callbacks
- Loading state management
- Reset functionality

**Validation**:

- [x] All tests from T004 pass (GREEN)
- [x] TypeScript interfaces implemented
- [x] Proper state transitions

---

## Phase 2: Component Development (T006-T009)

### T006: Generate ContactForm component structure

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 5 min

**Command**:

```bash
docker compose exec scripthammer pnpm run generate:component
# Select: forms
# Name: ContactForm
# Path: forms/ContactForm
```

**Auto-generated Files**:

- `src/components/forms/ContactForm/index.tsx`
- `src/components/forms/ContactForm/ContactForm.tsx`
- `src/components/forms/ContactForm/ContactForm.test.tsx`
- `src/components/forms/ContactForm/ContactForm.stories.tsx`

---

### T007: Write tests for ContactForm component

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 45 min

**Test Cases**:

- Component renders all form fields
- Form validation works correctly
- Submit button disabled during submission
- Success message displays after submission
- Error message displays on failure
- Honeypot field is hidden
- Accessibility attributes present

**Test First**:

```typescript
describe('ContactForm Component', () => {
  it('should render all form fields', () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it('should submit form successfully', async () => {
    const mockSubmit = jest.fn().mockResolvedValue({ success: true });
    render(<ContactForm onSuccess={mockSubmit} />);

    // Fill form and submit
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });
  });
});
```

---

### T008: Implement ContactForm component

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 1 hour

**Implementation Features**:

- Form layout using existing FormField components
- Real-time validation feedback
- Submit button with loading state
- Success/error message display
- Honeypot spam protection
- Responsive design
- Accessibility compliance

**Component Props**:

```typescript
interface ContactFormProps {
  className?: string;
  onSuccess?: (data: ContactFormData) => void;
  onError?: (error: FormError) => void;
  initialData?: Partial<ContactFormData>;
  enableAnalytics?: boolean;
}
```

**Validation**:

- [x] All tests from T007 pass (GREEN)
- [x] 4-file structure maintained
- [x] No accessibility violations

---

### T009: Create contact page and routing

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 30 min

**File**: `src/app/contact/page.tsx`

**Page Features**:

- ContactForm component integration
- SEO metadata and structured data
- Responsive page layout
- Breadcrumb navigation
- Error boundary for form errors

**Implementation**:

```typescript
export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
      <ContactForm
        enableAnalytics={true}
        onSuccess={() => gtag('event', 'form_submit', { form_name: 'contact' })}
      />
    </div>
  );
}
```

**Validation**:

- [x] Page renders without errors
- [x] SEO metadata included
- [x] Mobile-responsive design

---

## Phase 3: Advanced Features (T010-T017)

### T010: Implement offline submission queue

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 45 min

**File**: `src/utils/offline-queue.ts`

**Features**:

- Queue submissions when offline
- Persistent storage in localStorage
- Automatic retry when online
- Queue size limits (100 submissions)
- Expiration handling (24 hours)

**Implementation**:

```typescript
interface QueuedSubmission {
  id: string;
  formData: ContactFormData;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'retrying' | 'failed';
}

export const addToQueue = (data: ContactFormData): void => {
  // Add submission to queue
};

export const processQueue = async (): Promise<void> => {
  // Process all queued submissions
};
```

---

### T011: Update Service Worker for background sync

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 30 min

**File**: `public/sw.js`

**Service Worker Updates**:

- Register background sync event
- Process offline form submissions
- Show notification on successful sync
- Handle sync failures gracefully

**Implementation**:

```javascript
self.addEventListener('sync', (event) => {
  if (event.tag === 'contact-form-submission') {
    event.waitUntil(processOfflineSubmissions());
  }
});

async function processOfflineSubmissions() {
  // Process queued form submissions
}
```

---

### T012: Write tests for form validation

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 30 min

**Additional Validation Tests**:

- Edge cases for each field
- Cross-field validation
- Spam detection logic
- Sanitization effectiveness
- Performance with large inputs

---

### T013: Implement client-side rate limiting

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 30 min

**File**: `src/utils/rate-limiting.ts`

**Rate Limiting Features**:

- 5 submissions per 5-minute window
- Persistent storage in localStorage
- User-friendly error messages
- Automatic reset after cooldown

**Configuration**:

```typescript
const RATE_LIMIT_CONFIG = {
  maxSubmissions: 5,
  timeWindow: 300000, // 5 minutes
  blockDuration: 900000, // 15 minutes
};
```

---

### T014: Add spam protection (honeypot)

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 20 min

**Honeypot Implementation**:

- Hidden form field `_gotcha`
- Positioned off-screen with CSS
- Validation fails if field has value
- No impact on legitimate users

**CSS Implementation**:

```css
.honeypot {
  position: absolute;
  left: -9999px;
  top: -9999px;
}
```

---

### T015: Integrate with consent system

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 30 min

**Integration Points**:

- Check analytics consent before tracking
- Respect functional consent for drafts
- Form submission always allowed (necessary)
- Privacy-conscious data handling

**Implementation**:

```typescript
const { canUseCookies } = useConsent();
const canTrack = canUseCookies(CookieCategory.ANALYTICS);
const canSaveDrafts = canUseCookies(CookieCategory.FUNCTIONAL);
```

---

### T016: Implement form analytics tracking

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 30 min

**Analytics Events**:

- Form started (first field focus)
- Form completed (all fields filled)
- Form submitted (button clicked)
- Submission success/failure
- Validation errors by field
- Form abandonment tracking

**Integration with useAnalytics**:

```typescript
const { trackEvent } = useAnalytics();

trackEvent('form_start', {
  form_name: 'contact',
  form_version: '1.0.0',
});
```

---

### T017: Add form draft auto-save feature

**Priority**: P2 Nice to have
**Status**: ⬜ Not Started
**Effort**: 45 min

**Auto-save Features**:

- Save draft every 10 seconds
- Restore draft on page reload
- Clear draft after successful submission
- Respect functional consent
- Show draft status indicator

**Implementation**:

```typescript
const useDraftSave = (formData: Partial<ContactFormData>) => {
  useEffect(() => {
    if (canSaveDrafts && hasSignificantData(formData)) {
      saveDraft(formData);
    }
  }, [formData]);
};
```

---

## Phase 4: Testing & Quality (T018-T021)

### T018: Write integration tests

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 45 min

**File**: `src/tests/contact-form-integration.test.tsx`

**Integration Test Scenarios**:

- Complete form submission flow
- Error handling and recovery
- Offline submission and sync
- Analytics tracking verification
- Consent system integration

**Test Implementation**:

```typescript
describe('Contact Form Integration', () => {
  it('should complete full submission flow', async () => {
    render(<ContactFormIntegration />);

    // Fill form
    await fillContactForm();

    // Submit
    await submitForm();

    // Verify success
    expect(screen.getByText(/message sent successfully/i)).toBeInTheDocument();
  });
});
```

---

### T019: Write accessibility tests

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 30 min

**Accessibility Requirements**:

- Keyboard navigation support
- Screen reader compatibility
- Form field associations
- Error message announcements
- Focus management
- WCAG 2.1 AA compliance

**Test Implementation**:

```typescript
describe('Contact Form Accessibility', () => {
  it('should be keyboard navigable', async () => {
    render(<ContactForm />);

    const nameField = screen.getByLabelText(/name/i);
    nameField.focus();

    userEvent.tab();
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
  });
});
```

---

### T020: Update Storybook stories

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 20 min

**Story Variations**:

- Default form state
- With validation errors
- Loading/submitting state
- Success state
- Error state
- With initial data

**Story Implementation**:

```typescript
export const Default: Story = {};

export const WithErrors: Story = {
  play: async ({ canvasElement }) => {
    // Trigger validation errors
  },
};

export const Loading: Story = {
  args: {
    isSubmitting: true,
  },
};
```

---

### T021: Create error handling documentation

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 30 min

**Documentation Topics**:

- Error types and recovery strategies
- Network failure handling
- Rate limiting behavior
- Spam detection responses
- User-friendly error messages
- Troubleshooting guide

---

## Phase 5: Configuration & Polish (T022-T025)

### T022: Update CSP headers for Web3Forms

**Priority**: P0 Critical
**Status**: ⬜ Not Started
**Effort**: 15 min

**File**: `next.config.ts`

**CSP Updates**:

```typescript
'connect-src': [
  // existing sources...
  'https://api.web3forms.com',
],
'form-action': [
  "'self'",
  'https://api.web3forms.com',
]
```

**Validation**:

- [x] Form submissions work without CSP violations
- [x] Browser console shows no CSP errors

---

### T023: Create contact form usage guide

**Priority**: P2 Nice to have
**Status**: ⬜ Not Started
**Effort**: 30 min

**Documentation**: `docs/CONTACT-FORM.md`

**Guide Contents**:

- Web3Forms setup instructions
- Environment variable configuration
- Customization options
- Troubleshooting common issues
- Analytics integration guide

---

### T024: Performance testing and optimization

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 30 min

**Performance Metrics**:

- Form render time < 200ms
- Validation feedback < 100ms
- Submission response < 3000ms
- Bundle size impact < 8KB
- No layout shift during loading

**Optimization Techniques**:

- Lazy load contact page
- Debounce validation (300ms)
- Optimize component re-renders
- Minimize bundle impact

---

### T025: Update project documentation

**Priority**: P1 Important
**Status**: ⬜ Not Started
**Effort**: 20 min

**Documentation Updates**:

- Update README.md with contact form info
- Add Web3Forms setup to quickstart
- Update CLAUDE.md with new patterns
- Document environment variables

---

## Implementation Order

### Day 1 (8 hours)

**Morning (4 hours)**: T001-T005 (Core Infrastructure)

- Schema, utilities, and hook development
- TDD approach with comprehensive testing

**Afternoon (4 hours)**: T006-T009 (Component Development)

- Component generation and implementation
- Contact page creation

### Day 2 (3.5 hours)

**Morning (2 hours)**: T010-T017 (Advanced Features)

- Offline support, analytics, rate limiting
- Privacy integration

**Afternoon (1.5 hours)**: T018-T025 (Testing & Polish)

- Integration tests, documentation
- Performance optimization

---

## Success Criteria

### Technical Requirements

- [ ] 100% TypeScript coverage
- [ ] Zero accessibility violations (WCAG 2.1 AA)
- [ ] 95%+ test coverage
- [ ] No CSP violations
- [ ] Performance targets met

### Functional Requirements

- [ ] Form submits successfully via Web3Forms
- [ ] Client-side validation prevents invalid submissions
- [ ] Offline submissions queue and sync when online
- [ ] Spam protection blocks automated submissions
- [ ] Rate limiting prevents abuse

### Privacy & Analytics

- [ ] Respects user consent preferences
- [ ] Analytics tracking only with consent
- [ ] Draft saving only with functional consent
- [ ] Clear privacy handling

### User Experience

- [ ] Clear validation feedback
- [ ] Loading states during submission
- [ ] Success/error messages
- [ ] Mobile-responsive design
- [ ] Keyboard accessible

---

## Dependencies

### External Requirements

- Web3Forms account and access key
- Environment variable `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`

### Internal Dependencies

- ConsentContext (PRP-007) ✅ Available
- useAnalytics hook (PRP-008) ✅ Available
- FormField components ✅ Available
- useFormValidation hook ✅ Available

### Environment Setup

```bash
# Add to .env.local
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_access_key_here
```

---

## Testing Commands

```bash
# Run all form-related tests
docker compose exec scripthammer pnpm test src/schemas/contact
docker compose exec scripthammer pnpm test src/utils/web3forms
docker compose exec scripthammer pnpm test src/hooks/useWeb3Forms
docker compose exec scripthammer pnpm test src/components/forms/ContactForm

# Run integration tests
docker compose exec scripthammer pnpm test src/tests/contact-form

# Check test coverage
docker compose exec scripthammer pnpm test:coverage

# Run accessibility audit
docker compose exec scripthammer pnpm test:a11y

# Build and check for errors
docker compose exec scripthammer pnpm run build
```

---

## Risk Mitigation

| Risk             | Impact | Mitigation                            |
| ---------------- | ------ | ------------------------------------- |
| API key exposure | Low    | Web3Forms designed for public keys    |
| Spam submissions | Medium | Honeypot + rate limiting + validation |
| Network failures | Medium | Retry logic + offline queue           |
| CSP violations   | High   | Test headers thoroughly               |
| Form abandonment | Low    | Auto-save drafts + analytics          |

---

Generated: 2025-09-15
Phase: 2 - Forms & Integrations
PRP: 009-web3forms-integration
Status: Ready for implementation

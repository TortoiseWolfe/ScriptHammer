# Task Breakdown: Cookie Consent & GDPR Compliance

## Overview

This document provides a detailed task breakdown for implementing the Cookie Consent & GDPR Compliance feature. Each task follows TDD methodology with tests written first (RED), implementation second (GREEN), then refactoring if needed.

## Task Tracking

| Task ID | Description                               | Status       | Priority | Estimated Time |
| ------- | ----------------------------------------- | ------------ | -------- | -------------- |
| T001    | Create consent type definitions           | ✅ Completed | Critical | 30 min         |
| T002    | Write tests for consent utilities         | ✅ Completed | Critical | 45 min         |
| T003    | Implement consent utility functions       | ✅ Completed | Critical | 45 min         |
| T004    | Write tests for ConsentContext            | ✅ Completed | Critical | 1 hour         |
| T005    | Implement ConsentContext provider         | ✅ Completed | Critical | 1 hour         |
| T006    | Write tests for CookieConsent banner      | ✅ Completed | High     | 1 hour         |
| T007    | Implement CookieConsent banner component  | ✅ Completed | High     | 1.5 hours      |
| T008    | Write tests for ConsentModal              | ✅ Completed | High     | 1 hour         |
| T009    | Implement ConsentModal component          | ✅ Completed | High     | 1.5 hours      |
| T010    | Write tests for PrivacyControls           | ✅ Completed | Medium   | 45 min         |
| T011    | Implement PrivacyControls component       | ✅ Completed | Medium   | 1 hour         |
| T012    | Write tests for privacy utilities         | ✅ Completed | High     | 45 min         |
| T013    | Implement data export functionality       | ✅ Completed | High     | 1 hour         |
| T014    | Implement data deletion functionality     | ✅ Completed | High     | 45 min         |
| T015    | Write tests for consent history           | ✅ Completed | Medium   | 30 min         |
| T016    | Implement consent history tracking        | ✅ Completed | Medium   | 45 min         |
| T017    | Write tests for analytics integration     | ✅ Completed | High     | 45 min         |
| T018    | Implement conditional analytics loading   | ✅ Completed | High     | 1 hour         |
| T019    | Update theme persistence for consent      | ✅ Completed | Medium   | 30 min         |
| T020    | Update accessibility settings for consent | ✅ Completed | Medium   | 30 min         |
| T021    | Create Privacy Policy page                | ✅ Completed | Low      | 30 min         |
| T022    | Create Cookie Policy page                 | ✅ Completed | Low      | 30 min         |
| T023    | Write integration tests                   | ✅ Completed | High     | 1 hour         |
| T024    | Write accessibility tests                 | ✅ Completed | High     | 45 min         |
| T025    | Update project documentation              | ✅ Completed | Low      | 30 min         |

**Total Estimated Time**: ~20 hours

---

## Phase 1: Core Infrastructure (T001-T005)

### T001: Create consent type definitions

**File**: `src/utils/consent-types.ts`

**Acceptance Criteria**:

- [ ] Define CookieCategory enum (NECESSARY, FUNCTIONAL, ANALYTICS, MARKETING)
- [ ] Create ConsentState interface with all required fields
- [ ] Define ConsentMethod enum for tracking how consent was given
- [ ] Create ConsentContextValue interface for React Context
- [ ] Add validation type guards
- [ ] Export all types for use across the application

**Test First**:

```typescript
// src/utils/consent-types.test.ts
import { CookieCategory, ConsentState, isValidConsent } from './consent-types';

describe('Consent Types', () => {
  it('should have all required cookie categories', () => {
    expect(CookieCategory.NECESSARY).toBe('necessary');
    expect(CookieCategory.FUNCTIONAL).toBe('functional');
    expect(CookieCategory.ANALYTICS).toBe('analytics');
    expect(CookieCategory.MARKETING).toBe('marketing');
  });

  it('should validate consent state correctly', () => {
    const validConsent: ConsentState = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
      version: '1.0.0',
      lastUpdated: Date.now(),
      method: 'default',
    };
    expect(isValidConsent(validConsent)).toBe(true);
  });
});
```

---

### T002: Write tests for consent utilities

**File**: `src/utils/consent.test.ts`

**Acceptance Criteria**:

- [ ] Test getDefaultConsent() returns valid default state
- [ ] Test validateConsent() handles invalid data
- [ ] Test isConsentExpired() checks 13-month expiry
- [ ] Test migrateConsent() upgrades old versions
- [ ] Test formatForGoogleConsent() creates correct format
- [ ] Test cookie management helpers

---

### T003: Implement consent utility functions

**File**: `src/utils/consent.ts`

**Acceptance Criteria**:

- [ ] Implement getDefaultConsent() with all fields
- [ ] Implement validateConsent() with type checking
- [ ] Implement isConsentExpired() with 13-month check
- [ ] Implement migrateConsent() for version updates
- [ ] Implement cookie helper functions
- [ ] All tests from T002 pass (GREEN)

---

### T004: Write tests for ConsentContext

**File**: `src/contexts/ConsentContext.test.tsx`

**Acceptance Criteria**:

- [ ] Test initial state loading from localStorage
- [ ] Test updateConsent() updates specific category
- [ ] Test acceptAll() enables all categories
- [ ] Test rejectAll() only keeps necessary
- [ ] Test banner visibility control
- [ ] Test persistence to localStorage

**Test First**:

```typescript
// src/contexts/ConsentContext.test.tsx
import { render, screen, act } from '@testing-library/react';
import { ConsentProvider, useConsent } from './ConsentContext';

describe('ConsentContext', () => {
  it('should provide default consent state', () => {
    const TestComponent = () => {
      const { consent } = useConsent();
      return <div>{consent.necessary ? 'Necessary enabled' : 'No consent'}</div>;
    };

    render(
      <ConsentProvider>
        <TestComponent />
      </ConsentProvider>
    );

    expect(screen.getByText('Necessary enabled')).toBeInTheDocument();
  });
});
```

---

### T005: Implement ConsentContext provider

**File**: `src/contexts/ConsentContext.tsx`

**Acceptance Criteria**:

- [ ] Create ConsentContext with full type safety
- [ ] Implement ConsentProvider component
- [ ] Add localStorage read/write logic
- [ ] Implement all consent actions (accept, reject, update)
- [ ] Add useConsent hook for easy access
- [ ] All tests from T004 pass (GREEN)

---

## Phase 2: UI Components (T006-T011)

### T006: Write tests for CookieConsent banner

**File**: `src/components/privacy/CookieConsent/CookieConsent.test.tsx`

**Acceptance Criteria**:

- [ ] Test banner renders on first visit
- [ ] Test Accept All button updates consent
- [ ] Test Reject All button updates consent
- [ ] Test Customize button opens modal
- [ ] Test banner hides after choice
- [ ] Test accessibility (keyboard nav, ARIA)

---

### T007: Implement CookieConsent banner component

**File**: `src/components/privacy/CookieConsent/CookieConsent.tsx`

**Acceptance Criteria**:

- [ ] Create banner with slide-up animation
- [ ] Add Accept All, Reject All, Customize buttons
- [ ] Position at bottom of viewport
- [ ] Make responsive (mobile-friendly)
- [ ] Add proper ARIA labels and roles
- [ ] All tests from T006 pass (GREEN)

**Component Structure**:

```typescript
interface CookieConsentProps {
  position?: 'top' | 'bottom';
  className?: string;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onCustomize?: () => void;
}
```

---

### T008: Write tests for ConsentModal

**File**: `src/components/privacy/ConsentModal/ConsentModal.test.tsx`

**Acceptance Criteria**:

- [ ] Test modal opens when triggered
- [ ] Test category toggles work correctly
- [ ] Test necessary category is always on
- [ ] Test Save Preferences updates consent
- [ ] Test modal closes after save
- [ ] Test escape key closes modal

---

### T009: Implement ConsentModal component

**File**: `src/components/privacy/ConsentModal/ConsentModal.tsx`

**Acceptance Criteria**:

- [ ] Create modal with category toggles
- [ ] Show description for each category
- [ ] Disable toggle for necessary cookies
- [ ] Add Save Preferences button
- [ ] Implement keyboard navigation
- [ ] All tests from T008 pass (GREEN)

---

### T010: Write tests for PrivacyControls

**File**: `src/components/privacy/PrivacyControls/PrivacyControls.test.tsx`

**Acceptance Criteria**:

- [ ] Test displays current consent state
- [ ] Test Update Preferences opens modal
- [ ] Test Withdraw Consent resets to default
- [ ] Test Export Data triggers download
- [ ] Test Delete Data clears storage

---

### T011: Implement PrivacyControls component

**File**: `src/components/privacy/PrivacyControls/PrivacyControls.tsx`

**Acceptance Criteria**:

- [ ] Display current consent status
- [ ] Add Update Preferences button
- [ ] Add Withdraw Consent button
- [ ] Add Export My Data button
- [ ] Add Delete My Data button
- [ ] All tests from T010 pass (GREEN)

---

## Phase 3: Privacy Features (T012-T016)

### T012: Write tests for privacy utilities

**File**: `src/utils/privacy.test.ts`

**Acceptance Criteria**:

- [ ] Test exportUserData() collects all data
- [ ] Test clearUserData() removes storage
- [ ] Test generateExportFile() creates valid JSON
- [ ] Test downloadJSON() triggers download
- [ ] Test data includes consent history

---

### T013: Implement data export functionality

**File**: `src/utils/privacy.ts`

**Acceptance Criteria**:

- [ ] Collect data from localStorage
- [ ] Collect data from sessionStorage
- [ ] Include all cookies
- [ ] Format as structured JSON
- [ ] Create downloadable blob
- [ ] All export tests from T012 pass (GREEN)

---

### T014: Implement data deletion functionality

**File**: `src/utils/privacy.ts` (continued)

**Acceptance Criteria**:

- [ ] Clear specified localStorage keys
- [ ] Clear sessionStorage
- [ ] Remove non-necessary cookies
- [ ] Reset consent to default
- [ ] Log deletion for audit
- [ ] All deletion tests from T012 pass (GREEN)

---

### T015: Write tests for consent history

**File**: `src/utils/consent-history.test.ts`

**Acceptance Criteria**:

- [ ] Test history entry creation
- [ ] Test history storage limit (50 entries)
- [ ] Test history retrieval
- [ ] Test history in data export

---

### T016: Implement consent history tracking

**File**: `src/utils/consent-history.ts`

**Acceptance Criteria**:

- [ ] Create history entry on consent change
- [ ] Store in localStorage
- [ ] Limit to 50 entries (FIFO)
- [ ] Include timestamp and trigger
- [ ] All tests from T015 pass (GREEN)

---

## Phase 4: Integration (T017-T020)

### T017: Write tests for analytics integration

**File**: `src/utils/analytics.test.ts`

**Acceptance Criteria**:

- [ ] Test analytics doesn't load without consent
- [ ] Test analytics loads with consent
- [ ] Test Google Consent Mode updates
- [ ] Test gtag commands are correct

---

### T018: Implement conditional analytics loading

**File**: `src/utils/analytics.ts`

**Acceptance Criteria**:

- [ ] Check consent before loading scripts
- [ ] Implement Google Consent Mode v2
- [ ] Update consent mode on changes
- [ ] Block analytics without consent
- [ ] All tests from T017 pass (GREEN)

---

### T019: Update theme persistence for consent

**Files**: Update existing theme components

**Acceptance Criteria**:

- [ ] Check functional consent before localStorage
- [ ] Fallback to sessionStorage if no consent
- [ ] Update ThemeProvider to check consent
- [ ] Maintain theme without cookies

---

### T020: Update accessibility settings for consent

**Files**: Update existing accessibility components

**Acceptance Criteria**:

- [ ] Check functional consent for preferences
- [ ] Use memory storage as fallback
- [ ] Update AccessibilityContext
- [ ] Preserve settings in session

---

## Phase 5: Documentation & Legal (T021-T025)

### T021: Create Privacy Policy page

**File**: `src/app/privacy/page.tsx`

**Acceptance Criteria**:

- [ ] Create comprehensive privacy policy
- [ ] Include data collection details
- [ ] List all cookie categories
- [ ] Add contact information
- [ ] Make GDPR compliant

---

### T022: Create Cookie Policy page

**File**: `src/app/cookies/page.tsx`

**Acceptance Criteria**:

- [ ] List all cookies used
- [ ] Describe purpose of each
- [ ] Include duration and type
- [ ] Add opt-out instructions
- [ ] Link to consent settings

---

### T023: Write integration tests

**File**: `src/tests/consent-integration.test.tsx`

**Acceptance Criteria**:

- [ ] Test complete consent flow
- [ ] Test persistence across page loads
- [ ] Test analytics blocking/enabling
- [ ] Test data export end-to-end
- [ ] Test modal interactions

---

### T024: Write accessibility tests

**File**: `src/tests/consent-a11y.test.tsx`

**Acceptance Criteria**:

- [ ] Test keyboard navigation
- [ ] Test screen reader announcements
- [ ] Test focus management
- [ ] Test ARIA attributes
- [ ] Test color contrast

---

### T025: Update project documentation

**Files**: Various documentation files

**Acceptance Criteria**:

- [ ] Update README with consent info
- [ ] Add consent to quickstart guide
- [ ] Document integration steps
- [ ] Create compliance checklist
- [ ] Update CLAUDE.md with new commands

---

## Implementation Order

**Day 1 (8 hours)**:

1. Morning: T001-T005 (Core Infrastructure)
2. Afternoon: T006-T009 (Banner & Modal)

**Day 2 (8 hours)**:

1. Morning: T010-T016 (Privacy Features)
2. Afternoon: T017-T020 (Integration)

**Day 3 (4 hours)**:

1. T021-T025 (Documentation & Testing)

---

## Testing Commands

```bash
# Run all consent tests
docker compose exec scripthammer pnpm test src/utils/consent
docker compose exec scripthammer pnpm test src/contexts/Consent
docker compose exec scripthammer pnpm test src/components/privacy

# Run integration tests
docker compose exec scripthammer pnpm test src/tests/consent

# Check test coverage
docker compose exec scripthammer pnpm test:coverage

# Run accessibility audit
docker compose exec scripthammer pnpm test:a11y
```

---

## Success Criteria

- [ ] All 25 tasks completed
- [ ] 100% test coverage for consent code
- [ ] Zero accessibility violations
- [ ] GDPR compliance verified
- [ ] Performance impact < 5%
- [ ] Documentation complete

---

Generated: 2025-09-15
Phase: 3 - Privacy & Analytics
PRP: 007-cookie-consent

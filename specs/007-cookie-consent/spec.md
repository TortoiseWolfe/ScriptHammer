# Product Requirements Prompt (PRP)

**Feature Name**: Cookie Consent & GDPR Compliance  
**Priority**: P0 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A comprehensive cookie consent and GDPR compliance system that provides users with transparent control over their data. This includes a consent modal, privacy controls, data export/deletion capabilities, and cookie management.

### Why We're Building It

- Constitutional requirement (Section 4: Privacy-First, GDPR compliant)
- Currently marked as "❌ Sprint 3 Priority" in constitution
- Legal requirement for EU users
- Builds trust through transparency
- Demonstrates privacy-first architecture

### Success Criteria

- [ ] Cookie consent modal appears on first visit
- [ ] User preferences persist across sessions
- [ ] Granular control over cookie categories
- [ ] Data export functionality works
- [ ] Data deletion request handling
- [ ] GDPR-compliant privacy policy page
- [ ] Cookie policy documentation
- [ ] Accessibility compliant (keyboard nav, screen readers)

### Out of Scope

- Third-party consent management platforms
- Server-side user database
- Automated data deletion (manual process ok)
- Cookie scanning/discovery tools

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Modal Component Pattern

```typescript
// Current modal pattern at: src/components/atomic/Modal.tsx
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
```

#### LocalStorage Pattern

```typescript
// Theme persistence pattern at: src/components/ThemeSwitcher.tsx
useEffect(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    setTheme(savedTheme);
  }
}, []);
```

#### Context Pattern

```typescript
// Accessibility context at: src/contexts/AccessibilityContext.tsx
export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [fontSize, setFontSize] = useState('base');
  const [spacing, setSpacing] = useState('normal');
  // Context implementation
};
```

### Dependencies & Libraries

- React Context API (for consent state)
- localStorage (for persistence)
- No external cookie libraries needed
- DaisyUI modal components

### File Structure

```
src/
├── contexts/
│   └── ConsentContext.tsx      # NEW: Consent state management
├── components/
│   ├── privacy/
│   │   ├── CookieConsent/
│   │   │   ├── index.tsx
│   │   │   ├── CookieConsent.tsx
│   │   │   ├── CookieConsent.test.tsx
│   │   │   └── CookieConsent.stories.tsx
│   │   └── PrivacyControls/
│   │       ├── index.tsx
│   │       ├── PrivacyControls.tsx
│   │       ├── PrivacyControls.test.tsx
│   │       └── PrivacyControls.stories.tsx
├── app/
│   ├── privacy/
│   │   └── page.tsx            # Privacy policy page
│   └── cookies/
│       └── page.tsx            # Cookie policy page
└── utils/
    ├── consent.ts              # Consent utilities
    └── privacy.ts              # Data export/deletion
```

---

## 3. Technical Specifications

### Cookie Categories

```typescript
// src/utils/consent.ts
export enum CookieCategory {
  NECESSARY = 'necessary', // Always enabled
  FUNCTIONAL = 'functional', // Theme, language preferences
  ANALYTICS = 'analytics', // Google Analytics, Web Vitals
  MARKETING = 'marketing', // Future: advertising, remarketing
}

export interface ConsentState {
  necessary: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
  version: string;
}
```

### Consent Context

```typescript
// src/contexts/ConsentContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

interface ConsentContextType {
  consent: ConsentState;
  updateConsent: (category: CookieCategory, enabled: boolean) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
}

const CONSENT_KEY = 'cookie-consent';
const CONSENT_VERSION = '1.0.0';
```

### Data Export Format

```typescript
// src/utils/privacy.ts
export interface UserDataExport {
  timestamp: string;
  consent: ConsentState;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: string[];
  webVitals?: any[];
  preferences: {
    theme: string;
    fontSize: string;
    spacing: string;
  };
}
```

### Performance Requirements

- Banner render: < 100ms
- Consent save: Immediate (localStorage)
- Data export: < 2 seconds
- No impact on Core Web Vitals

---

## 4. Implementation Runbook

### Step 1: Create Consent Context

```typescript
// src/contexts/ConsentContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConsentState, CookieCategory } from '@/utils/consent';

export const ConsentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [consent, setConsent] = useState<ConsentState>(getDefaultConsent());
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setShowBanner(true);
    } else {
      setConsent(JSON.parse(stored));
    }
  }, []);

  // Implementation continues...
};
```

### Step 2: Build Cookie Consent Modal

1. Create modal component with DaisyUI styling
2. Add category toggles for each cookie type
3. Implement "Accept All", "Reject All", "Save Preferences"
4. Add link to cookie policy

### Step 3: Implement Privacy Controls

1. Create settings page for privacy management
2. Add data export functionality
3. Add data deletion request form
4. Show current consent status

### Step 4: Integrate with Existing Features

```typescript
// Update app/layout.tsx
import { ConsentProvider } from '@/contexts/ConsentContext';
import CookieConsent from '@/components/privacy/CookieConsent';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ConsentProvider>
          {children}
          <CookieConsent />
        </ConsentProvider>
      </body>
    </html>
  );
}
```

### Step 5: Update Analytics Integration

```typescript
// Conditionally load analytics based on consent
const { consent } = useConsent();

useEffect(() => {
  if (consent.analytics && window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
    });
  }
}, [consent.analytics]);
```

### Step 6: Testing

- [ ] Modal appears on first visit
- [ ] Preferences persist after reload
- [ ] Analytics blocked when rejected
- [ ] Data export includes all storage
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] Modal component exists
- [x] LocalStorage patterns established
- [x] Context providers working
- [ ] Legal requirements researched

### During Implementation

- [ ] Banner doesn't block content
- [ ] Preferences apply immediately
- [ ] No cookies set before consent
- [ ] Export format is complete

### Post-Implementation

- [ ] GDPR compliance verified
- [ ] Accessibility audit passed
- [ ] Performance impact < 5 points
- [ ] Documentation complete

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Banner blocks critical content
   **Mitigation**: Use overlay with dismiss option, not blocking modal

2. **Risk**: Consent not legally compliant
   **Mitigation**: Follow ICO/CNIL guidelines, explicit opt-in

3. **Risk**: Performance impact from checking consent
   **Mitigation**: Cache consent in memory after first check

4. **Risk**: Users confused by categories
   **Mitigation**: Clear descriptions and examples for each category

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 4: Security Framework)
- Modal Component: `/src/components/atomic/Modal.tsx`
- Theme Persistence: `/src/components/ThemeSwitcher.tsx`
- Accessibility Context: `/src/contexts/AccessibilityContext.tsx`

### External Resources

- [GDPR Cookie Guidance](https://gdpr.eu/cookies/)
- [ICO Cookie Guidance](https://ico.org.uk/for-organisations/guide-to-pecr/cookies-and-similar-technologies/)
- [Google Consent Mode](https://support.google.com/analytics/answer/9976101)
- [WCAG Modal Guidelines](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

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
PRP for Cookie Consent & GDPR Compliance
Generated from SpecKit constitution analysis
Implements privacy-first architecture
-->

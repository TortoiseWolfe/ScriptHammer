# Documentation Roadmap

**Author**: TechWriter Terminal
**Date**: 2026-01-15
**Status**: Proposed

---

## Priority Matrix

| Priority | Timing          | Focus                                         |
| -------- | --------------- | --------------------------------------------- |
| **P0**   | Before Wave 1   | Developer onboarding, contribution guidelines |
| **P1**   | During Wave 1-2 | Core feature docs as they ship                |
| **P2**   | Wave 3-4        | User guides for messaging/payments            |
| **P3**   | Wave 5+         | Enhancement docs, tutorials                   |
| **P4**   | Post-launch     | Marketing content, case studies               |

---

## P0: Pre-Implementation (Create Now)

### 1. CONTRIBUTING.md

**Purpose**: Enable external contributors
**Contents**:

- Development environment setup (Docker-first)
- Branch naming conventions
- PR process and review expectations
- Commit message format (Co-Authored-By pattern)
- Link to constitution.md for principles

### 2. docs/getting-started/README.md

**Purpose**: Developer quick-start
**Contents**:

- Prerequisites (Docker, Node 20+)
- Clone → Docker up → verify steps
- Project structure overview
- Where to find feature specs
- SpecKit workflow summary

### 3. docs/architecture/README.md

**Purpose**: System design reference
**Contents**:

- Tech stack decisions and rationale
- Static export constraint (GitHub Pages)
- Supabase integration patterns
- 5-file component pattern explanation
- Data flow diagrams

---

## P1: Foundation Wave (With Waves 1-2)

### 4. API Reference: Supabase RLS

**Aligns with**: Feature 000 (RLS Implementation)
**Contents**:

- RLS policy patterns
- Row-level security examples
- Testing RLS locally
- Common pitfalls

### 5. Authentication Guide

**Aligns with**: Feature 003 (User Authentication)
**Contents**:

- Auth flow diagrams
- Supabase Auth configuration
- Session handling
- Protected route patterns

### 6. Testing Guide

**Aligns with**: Feature 007 (E2E Testing Framework)
**Contents**:

- Vitest setup and patterns
- Playwright E2E conventions
- Pa11y accessibility testing
- Test file organization
- CI integration

### 7. Component Development Guide

**Aligns with**: Feature 006 (Component Template)
**Contents**:

- 5-file pattern walkthrough
- Storybook conventions
- Accessibility test patterns
- When to create new components

### 8. Accessibility Compliance Guide

**Aligns with**: Feature 001 (WCAG AA Compliance)
**Contents**:

- WCAG AA requirements checklist
- Keyboard navigation patterns
- Screen reader testing
- Color contrast requirements
- Touch target sizing (44px minimum)

---

## P2: Feature Documentation (Waves 3-4)

### 9. User Guide: Messaging

**Aligns with**: Features 009, 011, 012, 026
**Contents**:

- Sending messages
- Creating group chats
- Managing conversations
- Notification settings

### 10. User Guide: Payments

**Aligns with**: Features 024, 038-041
**Contents**:

- Payment methods
- Subscription management
- Transaction history
- Offline payment handling
- Retry failed payments

### 11. Admin Guide

**Aligns with**: Feature 014 (Admin Welcome Email Gate)
**Contents**:

- Admin dashboard overview
- User management
- Welcome email configuration
- Moderation tools

---

## P3: Enhancement Documentation (Waves 5-6)

### 12. User Guide: Accessibility Features

**Aligns with**: Features 017, 018
**Contents**:

- Colorblind mode options
- Font size/family switching
- Keyboard shortcuts reference
- Screen reader compatibility

### 13. User Guide: Blog & Content

**Aligns with**: Features 010, 025, 029
**Contents**:

- Creating blog posts
- SEO best practices
- Social sharing features
- Comment moderation

### 14. PWA Installation Guide

**Aligns with**: Feature 020
**Contents**:

- Installing on mobile/desktop
- Offline capabilities
- Background sync behavior
- Push notification setup

### 15. Geolocation & Maps Guide

**Aligns with**: Features 021, 028
**Contents**:

- Enabling location services
- Privacy controls
- Map interaction
- Location-based features

---

## P4: Post-Launch (After Core Complete)

### 16. Integration Guides

**Aligns with**: Features 022-023, 044-045
**Contents**:

- Web3Forms setup
- EmailJS configuration
- Sentry error tracking
- Disqus commenting

### 17. API Reference (Full)

**Contents**:

- All Supabase Edge Functions
- Request/response schemas
- Rate limiting
- Error codes

### 18. Tutorials

**Contents**:

- "Build your first feature" walkthrough
- "Add a new payment method" guide
- "Create accessible components" tutorial

### 19. Troubleshooting Guide

**Contents**:

- Common errors and solutions
- Debug logging
- Performance profiling
- Support escalation

---

## Documentation Standards

### File Organization

```
docs/
├── getting-started/
│   └── README.md           # Quick-start guide
├── architecture/
│   └── README.md           # System design
├── guides/
│   ├── developer/          # For contributors
│   │   ├── testing.md
│   │   ├── components.md
│   │   └── accessibility.md
│   └── user/               # For end users
│       ├── messaging.md
│       ├── payments.md
│       └── settings.md
├── api/
│   ├── auth.md
│   ├── rls.md
│   └── edge-functions.md
└── tutorials/
    └── [topic].md
```

### Writing Standards

- **Voice**: Active, second person ("You can...")
- **Code examples**: TypeScript with strict types
- **Screenshots**: From wireframes until UI exists
- **Versioning**: Match feature versions

### Review Process

1. Draft in feature branch
2. Technical review by Developer terminal
3. Accessibility review for user-facing docs
4. Merge with feature PR when possible

---

## Immediate Action Items

| Item                                    | Owner                  | Dependency |
| --------------------------------------- | ---------------------- | ---------- |
| Create CONTRIBUTING.md                  | TechWriter             | None       |
| Create docs/getting-started/README.md   | TechWriter             | None       |
| Create docs/architecture/README.md      | TechWriter + Architect | None       |
| Review existing blog posts for accuracy | TechWriter             | None       |

---

## Success Metrics

| Metric                     | Target                              |
| -------------------------- | ----------------------------------- |
| Time to first contribution | < 30 minutes with docs              |
| Documentation coverage     | 100% of shipped features            |
| User guide completeness    | All user-facing features documented |
| API reference accuracy     | Validated against implementation    |

---

## Dependencies

- **Architect**: System design input for architecture docs
- **Developer**: Code examples and technical review
- **QALead**: Validation of testing guide accuracy
- **Security**: Review of auth and RLS documentation

---

## Next Steps

1. Get CTO approval on this roadmap
2. Begin P0 documentation immediately
3. Coordinate with Developer terminal for code examples
4. Establish documentation review cadence

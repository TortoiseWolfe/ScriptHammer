# Research: Cookie Consent & GDPR Compliance

## GDPR Requirements Analysis

### Key Legal Requirements

#### 1. Lawful Basis for Processing

GDPR Article 6 defines six lawful bases, but for cookies, **consent** is typically required:

- Must be freely given
- Specific and informed
- Unambiguous indication
- Withdrawable at any time

#### 2. Cookie Law (ePrivacy Directive)

- Requires consent before storing/accessing non-essential cookies
- Strictly necessary cookies exempt from consent
- Must provide clear information about cookies used

#### 3. Consent Requirements (Article 7)

- **Explicit opt-in**: Pre-ticked boxes not valid
- **Granular control**: Separate consent for different purposes
- **Easy withdrawal**: As easy to withdraw as to give
- **Record keeping**: Must demonstrate consent was obtained

### Cookie Categories Research

#### Industry Standards

Based on analysis of major sites (Google, Microsoft, Facebook):

| Category           | Common Names            | Purpose            | Examples                                 |
| ------------------ | ----------------------- | ------------------ | ---------------------------------------- |
| Strictly Necessary | Essential, Required     | Core functionality | Authentication, Security, Load balancing |
| Functional         | Preferences, Features   | Enhanced UX        | Language, Theme, Accessibility           |
| Analytics          | Statistics, Performance | Usage analysis     | Google Analytics, Hotjar, Mixpanel       |
| Marketing          | Advertising, Targeting  | Personalized ads   | Google Ads, Facebook Pixel, Retargeting  |

#### Our Implementation

Simplified to 4 categories for clarity:

1. **Necessary** - Always enabled (no consent needed)
2. **Functional** - User preferences and settings
3. **Analytics** - Anonymous usage tracking
4. **Marketing** - Future advertising capabilities

### Technical Implementation Patterns

#### 1. Consent Banner Patterns

**Pattern A: Bottom Bar** (Used by Google, GitHub)

- Pros: Non-intrusive, doesn't block content
- Cons: Easy to ignore, may not be noticed

**Pattern B: Modal Overlay** (Used by Medium, NYTimes)

- Pros: Can't be missed, clear focus
- Cons: Blocks content, interrupts user flow

**Pattern C: Corner Toast** (Used by Vercel, Stripe)

- Pros: Noticeable but not blocking
- Cons: May overlap important UI elements

**Decision**: Use Pattern A (bottom bar) with slide-up animation

#### 2. Consent Storage Mechanisms

**localStorage**

- Pros: Simple, synchronous, 5-10MB limit
- Cons: No expiration, client-side only
- Use for: Consent preferences

**Cookies**

- Pros: Server readable, expiration control
- Cons: 4KB limit, sent with every request
- Use for: Consent flag for server-side checks

**IndexedDB**

- Pros: Large storage, structured data
- Cons: Async, complex API
- Use for: Consent history (if needed)

**Decision**: localStorage for preferences, optional cookie for server

#### 3. Google Consent Mode v2

Google's framework for consent-aware analytics:

```javascript
// Default state (before consent)
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
});

// Update after consent
gtag('consent', 'update', {
  analytics_storage: consent.analytics ? 'granted' : 'denied',
  ad_storage: consent.marketing ? 'granted' : 'denied',
});
```

Benefits:

- Preserves basic analytics even without consent
- Modeling for missing data
- Compliance with Google Ads policies

### Accessibility Requirements

#### WCAG 2.1 Guidelines for Consent UI

1. **Perceivable**
   - Sufficient color contrast (4.5:1 minimum)
   - Text alternatives for icons
   - Clear visual hierarchy

2. **Operable**
   - Keyboard accessible (Tab, Enter, Escape)
   - No keyboard traps
   - Sufficient time to read/respond

3. **Understandable**
   - Plain language descriptions
   - Consistent navigation
   - Error identification

4. **Robust**
   - Valid HTML
   - ARIA labels and roles
   - Screen reader compatible

#### Implementation Requirements

- Focus management when banner appears
- Escape key to close modal
- Tab order preservation
- Announce consent changes to screen readers

### Performance Considerations

#### Loading Strategy

1. **Inline Critical CSS** - Prevent layout shift
2. **Lazy Load Modal** - Only load detailed view on demand
3. **Cache Consent State** - Check memory before localStorage
4. **Defer Non-Critical** - Load after main content

#### Bundle Size Impact

- Core consent logic: ~2KB gzipped
- UI components: ~5KB gzipped
- Total impact: < 10KB

### Compliance Best Practices

#### ICO (UK) Guidelines

1. Make consent prominent
2. Use clear, plain language
3. Provide granular options
4. Keep records of consent
5. Allow easy withdrawal

#### CNIL (France) Recommendations

1. Continue browsing ≠ consent
2. Reject as easy as accept
3. No "cookie walls"
4. Regular consent renewal (13 months)

#### Implementation Checklist

- [ ] No pre-ticked boxes
- [ ] Explicit action required
- [ ] Granular controls
- [ ] Equal prominence for accept/reject
- [ ] Clear cookie information
- [ ] Easy withdrawal mechanism
- [ ] Consent record keeping
- [ ] Version management

### Competitive Analysis

#### Successful Implementations

**Cloudflare**

- Simple 3-option banner
- Clear descriptions
- Minimal design
- Fast loading

**GitHub**

- Non-intrusive bottom bar
- Link to detailed settings
- Remember choice globally

**Stack Overflow**

- Detailed but scannable
- Category explanations
- Vendor list transparency

#### Common Pitfalls to Avoid

1. Dark patterns (hidden reject button)
2. Forced consent (cookie walls)
3. Confusing language
4. Too many categories
5. Slow loading banners

### Technical Decisions

Based on research, our implementation will:

1. **Use localStorage** for primary storage (simple, sufficient)
2. **Implement bottom bar** pattern (non-intrusive)
3. **Support Consent Mode v2** (future GA4 compatibility)
4. **Follow ICO guidelines** (UK-focused compliance)
5. **Prioritize accessibility** (WCAG 2.1 AA)
6. **Minimize performance impact** (< 10KB, < 100ms)

### References

1. [GDPR Article 7 - Conditions for consent](https://gdpr-info.eu/art-7-gdpr/)
2. [ICO Guidance on cookies](https://ico.org.uk/for-organisations/guide-to-pecr/cookies-and-similar-technologies/)
3. [Google Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent)
4. [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
5. [CNIL Cookie Guidelines](https://www.cnil.fr/en/cookies-and-other-tracking-devices-cnil-publishes-new-guidelines)

---

Research completed: 2025-09-15
Next: Generate data-model.md

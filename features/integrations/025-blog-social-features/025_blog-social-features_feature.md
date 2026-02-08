# Feature: Blog Social Media Features

**Feature ID**: 025
**Category**: integrations
**Source**: ScriptHammer_v_001/docs/specs/019-blog-social-features
**Status**: Ready for SpecKit

## Description

Social media integration for blog posts including sharing buttons, author profiles with social links, and atomic component breakdown. Enables readers to share content and learn more about authors while maintaining privacy compliance.

## User Scenarios

### US-1: Share Blog Post (P1)

A reader finds a valuable post and wants to share it with their network on social media.

**Acceptance Criteria**:

1. Given a blog post, when share button clicked, then post is shared to chosen platform
2. Given sharing initiated, when platform opens, then title, description, and image are pre-populated
3. Given share completed, when followers click link, then they arrive at full blog post

### US-2: View Author Profile (P1)

A reader wants to learn more about the author and connect with them on social media.

**Acceptance Criteria**:

1. Given a blog post, when viewing author section, then bio and social links are visible
2. Given social link clicked, when navigating, then it opens in new tab
3. Given author has no social links, when viewing profile, then only bio is shown

### US-3: Rich Social Previews (P2)

When posts are shared, they display rich previews on social platforms with proper metadata.

**Acceptance Criteria**:

1. Given post shared to Twitter, when link previewed, then Twitter Card shows image and description
2. Given post shared to LinkedIn, when link previewed, then Open Graph data displays correctly
3. Given post without image, when shared, then default site image is used

### US-4: Accessible Sharing (P2)

Sharing functionality is accessible to all users including those using assistive technology.

**Acceptance Criteria**:

1. Given share buttons, when screen reader active, then proper ARIA labels are announced
2. Given JavaScript disabled, when sharing attempted, then fallback copy link works
3. Given keyboard navigation, when using tabs, then all share buttons are focusable

## Requirements

### Functional

- FR-001: Social sharing buttons for Twitter/X, LinkedIn, Facebook, Reddit
- FR-002: Generate Open Graph meta tags for rich previews
- FR-003: Generate Twitter Card metadata for enhanced previews
- FR-004: Display author profiles with bio and social links
- FR-005: Open social links in new tabs to maintain blog session
- FR-006: Provide email sharing as platform-independent fallback
- FR-007: Provide fallback when JavaScript is disabled
- FR-008: Display appropriate platform icons
- FR-009: Handle missing author information gracefully
- FR-010: Track share events for analytics (privacy-compliant)
- FR-011: Support dark/light theme adaptation
- FR-012: Allow authors to optionally hide social section
- FR-013: Validate social media URLs for author profiles
- FR-014: Provide accessible sharing with proper ARIA labels

### Non-Functional

- NFR-001: Social sharing buttons load within 2 seconds
- NFR-002: Zero broken social media links in author profiles
- NFR-003: WCAG 2.1 AA compliance for all social components
- NFR-004: No external tracking scripts without consent

### API Key Handling

**Static Export Compliance**: Social sharing uses native share URLs that don't require API keys:

```typescript
// No API keys needed - direct URL construction
const shareUrls = {
  twitter: (url: string, text: string) =>
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  linkedin: (url: string) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  facebook: (url: string) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  reddit: (url: string, title: string) =>
    `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
};
```

**If ShareThis/AddThis integration is desired** (optional):

- Store `NEXT_PUBLIC_SHARETHIS_PROPERTY_ID` in environment (public key is safe for client)
- ShareThis loads only after user consents (Feature 019 consent framework)
- No server-side API calls required - all client-side

### Atomic Components

- **SocialShareButton**: Individual platform button with icon
- **SocialShareGroup**: Container for multiple share buttons
- **AuthorAvatar**: Profile image with fallback to initials
- **AuthorBio**: Text component for author description
- **SocialLink**: Individual social media link with icon
- **AuthorSocialLinks**: Container for author's social links
- **AuthorProfile**: Complete author section combining all elements
- **ShareMetadata**: Non-visual component for meta tags

### Key Entities

- **Post**: Title, description, featured image, author, URL
- **Author**: Name, bio, avatar, social media accounts
- **SocialPlatform**: Name, icon, URL template, metadata requirements
- **ShareEvent**: Platform, post, timestamp, referrer
- **SocialLink**: Platform, username/URL, display preference

### Out of Scope

- Social media follower counts display
- Integrated social media feeds
- Advanced sharing analytics dashboard
- Automated social media posting
- Real-time social proof indicators

## Success Criteria

- SC-001: Share buttons work for all major platforms
- SC-002: Open Graph and Twitter Card metadata renders correctly
- SC-003: Author profiles display with social links
- SC-004: Sharing buttons load within 2 seconds
- SC-005: All components pass WCAG 2.1 AA accessibility audit
- SC-006: Theme adaptation works for dark and light modes

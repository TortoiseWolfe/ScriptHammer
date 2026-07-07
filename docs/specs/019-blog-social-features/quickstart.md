# Quickstart: Blog Social Media Features

## Prerequisites

- Docker environment running (`docker compose up`)
- Node.js 20+ and pnpm 10.16.1
- Access to component generator

## Setup Steps

### 1. Generate Components

```bash
# Generate all 8 atomic components
docker compose exec scripthammer pnpm run generate:component SocialShareButton blog
docker compose exec scripthammer pnpm run generate:component SocialShareGroup blog
docker compose exec scripthammer pnpm run generate:component AuthorAvatar blog
docker compose exec scripthammer pnpm run generate:component AuthorBio blog
docker compose exec scripthammer pnpm run generate:component SocialLink blog
docker compose exec scripthammer pnpm run generate:component AuthorSocialLinks blog
docker compose exec scripthammer pnpm run generate:component AuthorProfile blog
docker compose exec scripthammer pnpm run generate:component ShareMetadata blog
```

### 2. Create Configuration Files

```bash
# Create author configuration
touch src/config/authors.ts
touch src/config/social.ts
```

### 3. Run Tests to Verify Setup

```bash
# Run all tests (should fail initially - TDD)
docker compose exec scripthammer pnpm test

# Run specific component tests
docker compose exec scripthammer pnpm test SocialShareButton

# Run accessibility tests
docker compose exec scripthammer pnpm test:a11y
```

## Basic Usage Examples

### Adding Social Share Buttons to a Blog Post

```tsx
import { SocialShareGroup } from '@/components/blog/SocialShareGroup';

export default function BlogPost({ post }) {
  const shareContent = {
    url: `https://example.com/blog/${post.slug}`,
    title: post.title,
    description: post.excerpt,
    tags: post.tags,
    author: post.author,
  };

  return (
    <article>
      {/* Post content */}

      <footer>
        <SocialShareGroup
          content={shareContent}
          layout="horizontal"
          showCopyLink={true}
        />
      </footer>
    </article>
  );
}
```

### Adding Author Profile

```tsx
import { AuthorProfile } from '@/components/blog/AuthorProfile';

export default function BlogPost({ post }) {
  return (
    <article>
      {/* Post content */}

      <AuthorProfile authorId={post.author} variant="full" showSocial={true} />
    </article>
  );
}
```

### Configuring Authors

```typescript
// src/config/authors.ts
export const authors = {
  'john-doe': {
    id: 'john-doe',
    name: 'John Doe',
    role: 'Senior Developer',
    bio: 'Passionate about web development and open source.',
    avatar: '/images/authors/john-doe.jpg',
    social: {
      github: 'https://github.com/johndoe',
      twitter: 'https://twitter.com/johndoe',
      linkedin: 'https://linkedin.com/in/johndoe',
    },
  },
};
```

## Testing Scenarios

### User Story 1: Share a Blog Post

```bash
# Test: User can share to Twitter
1. Navigate to any blog post
2. Scroll to share buttons
3. Click Twitter share button
4. Verify new tab opens with pre-filled tweet
5. Verify share event tracked (if consented)
```

### User Story 2: View Author Profile

```bash
# Test: User can see author information
1. Navigate to blog post
2. Scroll to author section
3. Verify author name, role, and bio visible
4. Click GitHub link
5. Verify opens in new tab to correct profile
```

### User Story 3: Copy Share Link

```bash
# Test: User can copy link to clipboard
1. Navigate to blog post
2. Click "Copy Link" button
3. Verify success message appears
4. Verify URL copied to clipboard
5. Paste in new tab and verify navigation
```

## Storybook Development

```bash
# Start Storybook
docker compose exec scripthammer pnpm run storybook

# View components at http://localhost:6006
# Navigate to Blog/SocialShareButton
# Test all variants and states
```

## Accessibility Testing

```bash
# Run Pa11y tests
docker compose exec scripthammer pnpm run test:a11y

# Manual keyboard testing
1. Tab through all share buttons
2. Verify focus indicators visible
3. Press Enter/Space to activate
4. Verify ARIA labels announced
```

## Performance Verification

```bash
# Check bundle size
docker compose exec scripthammer pnpm run build
docker compose exec scripthammer pnpm run analyze

# Verify Lighthouse scores
1. Open Chrome DevTools
2. Run Lighthouse audit
3. Verify Performance > 90
4. Verify Accessibility > 95
```

## Integration Checklist

### Blog Post Page (`/blog/[slug]`)

- [ ] Add SocialShareGroup after content
- [ ] Add AuthorProfile at end
- [ ] Update metadata for Open Graph
- [ ] Test sharing on all platforms

### Blog List Page (`/blog`)

- [ ] Add author info to PostCard
- [ ] Show social links in preview
- [ ] Test responsive layout

### Storybook Stories

- [ ] All 8 components have stories
- [ ] Dark/light theme variants
- [ ] Mobile/desktop layouts
- [ ] Error states documented

## Troubleshooting

### Share buttons not appearing

- Check if components generated correctly
- Verify import paths are correct
- Check console for errors

### Social links broken

- Verify author configuration
- Check URL validation in config
- Test with known working URLs

### Analytics not tracking

- Verify user consent given
- Check localStorage for consent
- Verify analytics enabled in config

## Next Steps

1. Implement component logic (TDD)
2. Add Storybook stories
3. Integrate with blog pages
4. Test on all platforms
5. Verify accessibility
6. Check performance metrics

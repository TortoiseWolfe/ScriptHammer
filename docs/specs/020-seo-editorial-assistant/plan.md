# Implementation Plan: SEO Editorial Assistant

## Overview

This plan outlines the implementation of the SEO Editorial Assistant with export/import functionality for the blog system. The feature enables editing markdown blog posts with real-time SEO analysis and bundling them for email-based workflows.

---

## Phase 1: Editor Enhancement for Markdown Files

### Objective

Enable the blog editor to load, edit, and save markdown files from the `/blog` directory.

### Components

#### 1.1 Markdown API Routes

```typescript
// src/app/api/blog/markdown/[slug]/route.ts
- GET: Read markdown file, parse frontmatter, return structured data
- PUT: Update markdown file with new content and frontmatter
- Validation: Ensure frontmatter structure preserved
```

#### 1.2 Editor Page Updates

```typescript
// src/app/blog/editor/page.tsx
- Add slug parameter support (?slug=spec-kit-workflow)
- Load markdown via API when slug present
- Parse frontmatter into form fields
- Preserve markdown formatting
```

#### 1.3 Blog Post Page Edit Button

```typescript
// src/app/blog/[slug]/page.tsx
- Add "Edit Post" button in header
- Link to /blog/editor?slug={slug}
- Only show for appropriate users (future: auth)
```

### Technical Decisions

- Use `gray-matter` for frontmatter parsing
- Keep markdown files as source of truth
- No database storage for blog content
- Validate frontmatter schema on save

---

## Phase 2: SEO Analysis Service

### Objective

Implement comprehensive SEO analysis with real-time feedback.

### Components

#### 2.1 Readability Analysis

```typescript
// src/lib/seo/readability.ts
- Flesch Reading Ease calculation
- Syllable counting algorithm
- Sentence/paragraph analysis
- Passive voice detection
```

#### 2.2 Technical SEO Checks

```typescript
// src/lib/seo/technical.ts
- Title length validation (50-60 chars)
- Meta description check (150-160 chars)
- URL slug optimization
- Heading hierarchy validation
```

#### 2.3 Content Quality Metrics

```typescript
// src/lib/seo/content.ts
- Word count analysis
- Link ratio calculation
- Image alt text verification
- Content structure scoring
```

#### 2.4 Keyword Optimization

```typescript
// src/lib/seo/keywords.ts
- Keyword density calculation
- Keyword placement analysis
- Related keyword suggestions
- Focus keyword tracking
```

### Technical Decisions

- Use Web Worker for heavy calculations
- Implement debouncing (500ms base)
- Cache analysis results
- Progressive calculation for large documents

---

## Phase 3: UI Components

### Objective

Create intuitive UI components for SEO feedback and interaction.

### Components

#### 3.1 SEOPanel Component

```typescript
// src/components/blog/SEOPanel/
- Container for all SEO features
- Collapsible/expandable design
- Real-time update display
- Terminal output toggle
```

#### 3.2 SEOScoreCard Component

```typescript
// src/components/blog/SEOScoreCard/
- Circular progress indicator
- Traffic light system (red/yellow/green)
- Score breakdown by category
- Animated transitions
```

#### 3.3 SEOSuggestions Component

```typescript
// src/components/blog/SEOSuggestions/
- Prioritized suggestion list
- Category grouping
- Action buttons for quick fixes
- Dismiss/ignore functionality
```

#### 3.4 Terminal Output Component

```typescript
// src/components/blog/TerminalOutput/
- Monospace formatted text
- Copy to clipboard button
- Syntax highlighting
- Collapsible sections
```

### Technical Decisions

- Follow 5-file component structure
- Use DaisyUI components
- Implement keyboard shortcuts
- Ensure mobile responsiveness

---

## Phase 4: Export System

### Objective

Enable bundling of blog posts with SEO reports for email workflows.

### Components

#### 4.1 Export Selection UI

```typescript
// src/components/blog/ExportDialog/
- Post selection checkboxes
- Date range filters
- Export options (include SEO, format)
- Progress indicator
```

#### 4.2 Bundle Generation Service

```typescript
// src/services/blog/export.ts
- ZIP file creation with JSZip
- Manifest generation
- SEO report compilation
- File structure organization
```

#### 4.3 Export API Endpoint

```typescript
// src/app/api/blog/export/route.ts
- Accept post selection
- Generate bundle
- Stream ZIP response
- Handle large exports
```

### Bundle Structure

```
blog-export-YYYY-MM-DD-HHmmss.zip
├── manifest.json
├── posts/
│   └── [slug].md
├── seo-reports/
│   ├── [slug]-seo.json
│   └── [slug]-seo.txt
└── summary.md
```

### Technical Decisions

- Use JSZip for compression
- Stream large files
- Include timestamps in filenames
- Generate human-readable summary

---

## Phase 5: Import System

### Objective

Enable importing ZIP bundles back into the blog system.

### Components

#### 5.1 Import Script

```bash
# scripts/import-blog-bundle.sh
- Validate ZIP structure
- Extract to temporary directory
- Backup existing files
- Copy to blog directory
- Show diff summary
```

#### 5.2 Import API (Optional)

```typescript
// src/app/api/blog/import/route.ts
- Accept ZIP upload
- Validate manifest
- Check for conflicts
- Apply changes
- Return summary
```

#### 5.3 Conflict Resolution

```typescript
// src/lib/blog/conflicts.ts
- Compare timestamps
- Detect content changes
- Merge strategies
- User prompts for resolution
```

### Technical Decisions

- Command-line first approach
- Automatic backups before import
- Preserve git history
- Validate markdown structure

---

## Phase 6: Testing & Documentation

### Objective

Ensure reliability and usability of the complete system.

### Testing Strategy

#### 6.1 Unit Tests

- SEO calculations
- Markdown parsing
- Export/import logic
- Component rendering

#### 6.2 Integration Tests

- Editor workflow
- API endpoints
- Export/import cycle
- SEO analysis accuracy

#### 6.3 E2E Tests

- Complete editorial workflow
- Export and email simulation
- Import and verification
- Edge cases

### Documentation

#### 6.4 User Documentation

- Video tutorial
- Step-by-step guide
- FAQ section
- Troubleshooting

#### 6.5 Developer Documentation

- API reference
- Bundle format specification
- Import script usage
- Extension points

---

## Implementation Timeline

### Week 1: Foundation

- Day 1-2: Editor enhancement for markdown
- Day 3-4: Basic SEO analysis service
- Day 5: Initial UI components

### Week 2: Core Features

- Day 1-2: Complete SEO analysis
- Day 3-4: UI polish and real-time updates
- Day 5: Terminal output and automation

### Week 3: Export/Import

- Day 1-2: Export system
- Day 3-4: Import system and scripts
- Day 5: Conflict resolution

### Week 4: Polish

- Day 1-2: Testing suite
- Day 3-4: Documentation
- Day 5: Release preparation

---

## Risk Management

### Technical Risks

| Risk                         | Mitigation                             |
| ---------------------------- | -------------------------------------- |
| Performance with large files | Implement streaming and chunking       |
| Markdown parsing edge cases  | Extensive test suite with real content |
| Browser memory limits        | Web Worker offloading                  |
| Frontmatter corruption       | Schema validation and backups          |

### User Experience Risks

| Risk                | Mitigation                          |
| ------------------- | ----------------------------------- |
| Complex workflow    | Clear documentation and tutorials   |
| Data loss fears     | Automatic backups and confirmations |
| SEO score confusion | Detailed explanations and tips      |
| Export size limits  | Chunking and compression options    |

---

## Success Criteria

- ✅ October blog posts editable with SEO feedback
- ✅ Export generates valid, importable bundles
- ✅ Round-trip preserves all content and structure
- ✅ SEO scores improve measurably
- ✅ Terminal output enables automation
- ✅ Zero data loss in production use

---

## Dependencies

### External Libraries

- `gray-matter`: ^4.0.3 - Frontmatter parsing
- `jszip`: ^3.10.0 - ZIP file handling
- `syllable`: ^5.0.0 - Readability calculations
- `reading-time`: ^1.5.0 - Read time estimation

### Internal Dependencies

- Existing blog infrastructure
- Markdown processing pipeline
- Editor components
- File system access

---

## Future Enhancements

1. **Direct Git Integration**: Commit from editor
2. **Multi-language SEO**: Spanish, French support
3. **AI Suggestions**: GPT-powered improvements
4. **Collaborative Editing**: Real-time multi-user
5. **Automated Email**: Nodemailer integration
6. **Version History**: Track all changes
7. **Bulk Operations**: Edit multiple posts
8. **SEO Templates**: Reusable optimization profiles

---

This plan provides a clear path to implementing the SEO Editorial Assistant with full export/import capabilities, addressing the GitHub Pages workflow requirements.

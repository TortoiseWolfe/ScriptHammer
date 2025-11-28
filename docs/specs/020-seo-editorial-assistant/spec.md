# Product Requirements Prompt (PRP)

**Feature Name**: SEO Editorial Assistant with Export System
**Priority**: P1 (User-Requested Enhancement)
**Sprint**: Sprint 4
**Status**: 📥 Inbox
**Created**: 2025-09-24
**Author**: TortoiseWolfe

---

## 1. Product Requirements

### What We're Building

An SEO Editorial Assistant that integrates with the blog editor to provide real-time SEO analysis and content optimization suggestions. The system must support editing existing markdown blog posts, analyzing their SEO performance, and exporting bundles of posts as ZIP files for email-based workflows. Developers can then unzip these bundles directly into the repository's `/blog` folder.

### Why We're Building It

- **GitHub Pages Limitation**: The one-way nature of GitHub Pages deployment requires a round-trip workflow for content updates
- **Content Quality**: Blog posts need SEO optimization to improve discoverability and readability
- **Automation Support**: Terminal-friendly output enables CI/CD integration and automated content workflows
- **Editorial Workflow**: Content creators need to edit, analyze, and bundle posts for developer review
- **October Content**: Existing October blog posts need SEO analysis and optimization

### Success Criteria

- [ ] Blog editor can load and edit existing markdown files from `/blog` directory
- [ ] Real-time SEO analysis during editing (Flesch readability, keyword density, technical SEO)
- [ ] SEO score with traffic light indicators (red/yellow/green)
- [ ] Export selected posts as ZIP bundle with SEO reports
- [ ] Import ZIP bundles back to `/blog` directory preserving structure
- [ ] Terminal-friendly output for automation workflows
- [ ] Support for both new posts and updates to existing posts
- [ ] Manifest file tracking changes in each bundle
- [ ] /editorial slash command for quick SEO analysis

### Out of Scope

- Direct git commits from the editor
- Database storage of blog posts (keep markdown files)
- Automated email sending (manual attachment for now)
- Real-time collaboration features
- Version control within the editor

---

## 2. Context & Codebase Intelligence

### Current Blog Architecture

```
blog/                         # Markdown blog posts with frontmatter
├── spec-kit-workflow.md     # October 1st post
├── *.md                      # Other blog posts
src/lib/blog/
├── demo-posts.ts            # Loads processed blog data
├── blog-data.json           # Generated from markdown files
src/app/blog/
├── page.tsx                 # Blog listing page
├── [slug]/page.tsx          # Individual blog post view
├── editor/page.tsx          # Blog editor (currently new posts only)
```

### Markdown Structure

```markdown
---
title: 'Post Title'
slug: 'post-slug'
excerpt: 'Brief description'
author: 'TortoiseWolfe'
publishDate: 2025-10-01
status: 'published'
categories: [Development, AI]
tags: [seo, blog, optimization]
---

# Post Content in Markdown
```

### Key Technologies

- **Next.js 15.5**: Static site generation with App Router
- **IndexedDB (Dexie)**: Offline-first storage for drafts
- **Markdown Files**: Source of truth for blog content
- **JSZip**: ZIP bundle creation and extraction
- **React 19**: UI components with TypeScript

---

## 3. User Experience

### Editor Workflow

1. **Navigate to Blog Post**
   - User visits `/blog/spec-kit-workflow` (October 1st post)
   - Clicks "Edit Post" button in header

2. **Editor Opens with SEO Panel**
   - URL: `/blog/editor?slug=spec-kit-workflow`
   - Markdown file loaded and parsed
   - SEO panel automatically visible on right
   - Real-time analysis as user types

3. **SEO Analysis Shows**
   - Overall score (0-100) with traffic light
   - Readability metrics (Flesch score, sentence length)
   - Technical SEO (title length, meta description)
   - Content quality (word count, structure)
   - Keyword optimization
   - Actionable suggestions prioritized

4. **Terminal Output**
   - Click "Show Terminal Output" button
   - Copyable text block for automation
   - Structured format for parsing

### Export Workflow

1. **Select Posts for Export**
   - Checkbox selection on blog listing
   - "Export Selected" button
   - Or "Export All October Posts"

2. **Generate Bundle**
   - Creates ZIP with structure:

   ```
   blog-export-2025-10-24.zip
   ├── manifest.json           # Bundle metadata
   ├── posts/
   │   ├── spec-kit-workflow.md
   │   └── [other-posts].md
   ├── seo-reports/
   │   ├── spec-kit-workflow-seo.json
   │   └── spec-kit-workflow-seo.txt
   └── summary.md             # Human-readable summary
   ```

3. **Download and Email**
   - Browser downloads ZIP file
   - User emails to developer
   - Includes summary of changes

### Import Workflow

1. **Developer Receives Bundle**
   - Downloads ZIP from email
   - Reviews manifest and changes

2. **Import to Repository**

   ```bash
   # Extract to blog directory
   unzip -o blog-export-*.zip -d temp/
   cp temp/posts/*.md blog/

   # Or use provided script
   ./scripts/import-blog-bundle.sh blog-export-*.zip
   ```

   Note: Conflicts are handled through git - developers can review diffs before committing

3. **Commit Changes**
   - Git diff shows changes
   - Developer reviews and commits
   - Deploys to GitHub Pages

---

## 4. Technical Requirements

### SEO Analysis Metrics

**Readability**

- Flesch Reading Ease Score (target: 60-70)
- Average sentence length (target: 15-20 words)
- Paragraph length (target: 3-5 sentences)
- Passive voice percentage (target: <10%)

**Technical SEO**

- Title length (50-60 characters)
- Meta description (150-160 characters)
- URL slug optimization
- Heading hierarchy (H1 → H2 → H3)
- Image alt text presence

**Content Quality**

- Word count (minimum: 300)
- Internal/external link ratio
- Keyword density (2-3%)
- Content structure score

**Keyword Analysis**

- Focus keyword presence in title
- Keyword distribution in content
- Related keywords suggestion
- Keyword in first paragraph

### Export Bundle Format

**manifest.json**

```json
{
  "version": "1.0.0",
  "created": "2025-10-24T10:00:00Z",
  "posts": [
    {
      "slug": "spec-kit-workflow",
      "title": "The Spec Kit Workflow...",
      "status": "updated",
      "seoScore": 85,
      "changes": ["content", "excerpt", "tags"]
    }
  ],
  "summary": {
    "totalPosts": 5,
    "newPosts": 1,
    "updatedPosts": 4,
    "averageSeoScore": 78
  }
}
```

### API Endpoints

```typescript
// Load markdown file for editing
GET /api/blog/markdown/:slug

// Save updated markdown
PUT /api/blog/markdown/:slug

// Analyze SEO
POST /api/blog/seo-analysis
Body: { content, title, excerpt, keywords }

// Export posts
POST /api/blog/export
Body: { postSlugs: string[], includeSeo: boolean }

// Import bundle
POST /api/blog/import
Body: FormData with ZIP file
```

---

## 5. Implementation Strategy

### Phase 1: Editor Enhancement (Week 1)

- Modify editor to load markdown files
- Add slug-based routing
- Parse and preserve frontmatter
- Save back to markdown format

### Phase 2: SEO Analysis (Week 1-2)

- Implement readability calculations
- Add technical SEO checks
- Create suggestion engine
- Build real-time analysis hook

### Phase 3: UI Components (Week 2)

- SEO score card with traffic lights
- Suggestions panel
- Terminal output display
- Keyboard shortcuts

### Phase 4: Export System (Week 3)

- ZIP bundle generation
- Manifest creation
- SEO report inclusion
- Download functionality

### Phase 5: Import System (Week 3)

- Bundle validation
- Markdown file updating
- Git-based conflict resolution (no custom merge UI)
- Import script

### Phase 6: Testing & Polish (Week 4)

- E2E tests for workflows
- Performance optimization
- Documentation
- Video tutorial

---

## 6. Success Metrics

- **Adoption**: 80% of blog posts edited use SEO analysis
- **Quality**: Average SEO score improves from 45 to 75
- **Efficiency**: Time to publish reduces by 40%
- **Automation**: 50% of updates use terminal output
- **Reliability**: Zero data loss in export/import cycle

---

## 7. Risks & Mitigations

| Risk                        | Impact | Mitigation                        |
| --------------------------- | ------ | --------------------------------- |
| Markdown parsing errors     | High   | Extensive testing with edge cases |
| Large bundle sizes          | Medium | Compression and chunking          |
| Frontmatter corruption      | High   | Validation before save            |
| Browser memory limits       | Medium | Streaming for large files         |
| SEO calculation performance | Low    | Web Worker implementation         |

---

## 8. Future Enhancements

- **Phase 2**: Git integration for direct commits
- **Phase 3**: Multi-language SEO support
- **Phase 4**: AI-powered content suggestions
- **Phase 5**: Collaborative editing
- **Phase 6**: Automated email with nodemailer

---

## 9. Acceptance Criteria

- [ ] Can edit October 1st blog post with SEO analysis
- [ ] SEO score updates in real-time (debounced)
- [ ] Export creates valid ZIP with all components
- [ ] Import preserves markdown structure perfectly
- [ ] Terminal output is parse-able by scripts
- [ ] No data loss during round-trip
- [ ] Works offline after initial load
- [ ] Accessible (WCAG AA compliant)

---

## 10. Dependencies

- `gray-matter`: Parse markdown frontmatter
- `jszip`: ZIP file creation
- `syllable`: Count syllables for readability
- `prismjs`: Syntax highlighting in editor
- Existing blog infrastructure
- Existing editor components

---

## Clarifications

### Session 2025-09-24

- Q: When importing a ZIP bundle, if a markdown file already exists with changes, how should conflicts be handled? → A: Follow git best practices (let version control handle it)

---

This specification provides a complete editorial workflow for blog content with SEO optimization, supporting the GitHub Pages deployment model through export/import cycles.

# Wireframe Plan: 010-unified-blog-content

**Feature**: Unified Blog Content Pipeline
**Planned By**: Planner Terminal
**Date**: 2026-01-14
**Status**: Ready for Generation

## Screen Analysis

Based on spec review, this feature requires the following key screens:

### User Story Coverage

| User Story                  | Priority | Required Screens                    |
| --------------------------- | -------- | ----------------------------------- |
| US1: Real-Time Dev Editing  | P1       | Blog Editor View                    |
| US2: Offline Editing & Sync | P1       | Blog Editor View (status indicator) |
| US3: Conflict Resolution    | P2       | Conflict Resolution UI              |
| US4: Content Migration      | P2       | Migration Dashboard (optional)      |
| US5: Rich Content Rendering | P3       | Blog Editor View (preview pane)     |

### Screen Consolidation

| Consolidated SVG             | Included Views                  | Rationale                                 |
| ---------------------------- | ------------------------------- | ----------------------------------------- |
| `01-blog-editor.svg`         | Editor, Preview, Offline Status | Core editing experience - single workflow |
| `02-conflict-resolution.svg` | Three-way merge UI, Visual diff | Complex dedicated interface               |

**Skipped**: Migration Dashboard - Admin one-time operation, lower UX priority

---

## Wireframe Assignments

### SVG 1: Blog Editor Interface

**File**: `01-blog-editor.svg`
**Assigned To**: Generator-1
**Priority**: P1

**Desktop View (1280x720)**:

- Split-pane layout: markdown editor (left), live preview (right)
- Toolbar with formatting buttons (bold, italic, code, link, image)
- Frontmatter panel (collapsed by default, expandable)
- Sync status indicator (top-right): "Saved", "Syncing...", "Offline - Changes Queued"
- File tree sidebar (left, collapsible)
- Current file tab with unsaved indicator (dot)

**Mobile View (360x720)**:

- Single-pane with toggle between Edit/Preview modes
- Simplified toolbar (essential actions only)
- Sync status as floating badge
- Hamburger menu for file navigation

**Callout Requirements**:

1. Markdown editor with syntax highlighting
2. Live preview pane with rendered content
3. Sync status indicator (3 states)
4. Frontmatter expander for metadata editing
5. Mobile edit/preview toggle
6. Offline queue indicator

---

### SVG 2: Conflict Resolution Interface

**File**: `02-conflict-resolution.svg`
**Assigned To**: Generator-2
**Priority**: P2

**Desktop View (1280x720)**:

- Three-column layout: Base (center-left), Local (left), Remote (right)
- Header: "Resolve Conflict: [Post Title]"
- Visual diff highlighting (insertions green, deletions red, changes yellow)
- Action buttons: "Use Local", "Use Remote", "Manual Merge"
- Merged result preview panel (bottom)
- Line-by-line navigation controls

**Mobile View (360x720)**:

- Tab-based view: Local | Remote | Merged
- Swipe navigation between versions
- Floating action button for resolution choice
- Simplified diff view (paragraph-level, not line-level)

**Callout Requirements**:

1. Three-way comparison layout
2. Visual diff highlighting legend
3. Conflict markers in content
4. Resolution action buttons
5. Merged result preview
6. Keyboard navigation hint (accessibility)

---

## Generator Queue Format

```json
{
  "feature": "010-unified-blog-content",
  "assignments": [
    {
      "svg": "01-blog-editor.svg",
      "assignedTo": "generator-1",
      "priority": "P1",
      "status": "pending"
    },
    {
      "svg": "02-conflict-resolution.svg",
      "assignedTo": "generator-2",
      "priority": "P2",
      "status": "pending"
    }
  ]
}
```

---

## Spec References

- FR-001 to FR-003: Content source management (editor UI)
- FR-004 to FR-006: Offline capabilities (sync status indicator)
- FR-017 to FR-020: Conflict resolution (three-way merge UI)
- NFR-001: 2-second hot reload (status feedback)
- NFR-009 to NFR-010: Accessibility requirements

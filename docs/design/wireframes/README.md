# ScriptHammer Wireframes

SVG wireframes for ScriptHammer features with automated validation and issue tracking.

## Workflow

### Generation
```bash
/wireframe-prep NNN    # Prime context, check escalation candidates
/wireframe NNN         # Generate SVG (user-triggered)
```

### Validation
```bash
python validate-wireframe.py NNN-feature/01-page.svg     # Validate single file
python validate-wireframe.py --all                        # Validate all SVGs
python validate-wireframe.py --check-escalation           # Find issues to escalate
```

### Inspection (Cross-SVG Consistency)
```bash
python inspect-wireframes.py --all                        # Check all SVGs for pattern deviations
python inspect-wireframes.py --report                     # JSON report only
```

### Issue Tracking
- **Auto-logged**: Validator writes issues to `NNN-feature/*.issues.md`
- **Escalation**: Issues seen in 2+ features promote to `GENERAL_ISSUES.md`
- **Policy**: Feature-specific first, general only after recurring pattern

## Viewing Wireframes

Open `index.html` in a browser to view all wireframes with navigation.

### Features
- Sidebar with clickable index
- Previous/Next navigation buttons
- Keyboard navigation:
  - `⇧F1-F9` Jump to category (Foundation, Core, Auth, etc.)
  - `^1-7` Jump to feature within current category
  - `1-9` Jump to spec within current feature
  - `←/→` Previous/Next wireframe
  - `↑/↓` or `+/-` Zoom, `0` reset to 85%
  - `L` Toggle legend, `F` Focus mode, `Escape` exit
- Pan and zoom (mouse wheel, drag, +/- keys)
- Dark theme for contrast with light SVG backgrounds

## Wireframe Structure

```
00-app-shell/              Desktop and mobile SPA layouts
06-components/             UI component reference library
```

## Development

Start the dev server with hot reload:

```bash
npm install
npm run dev
```

Browser opens automatically and refreshes when you edit any file.

## Creating Your Own Wireframes

1. Create SVG files in feature folders (e.g., `01-your-feature/`)
2. Add navigation links in `index.html`
3. Follow patterns from the component library

## Running Playwright Tests

Tests validate SVG loading and navigation.

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Run tests
npm test
```

Screenshots saved to `./screenshots/`

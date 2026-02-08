# ScriptHammer Wireframes

SVG wireframes for ScriptHammer features with automated validation and issue tracking.

## Quick Start

```bash
# Start the viewer with hot reload
npm install && npm run dev
```

Browser opens automatically at `http://localhost:3000`. Edit any SVG and the viewer refreshes.

---

## Using the Viewer

### Navigation

| Control           | Action                                  |
| ----------------- | --------------------------------------- |
| **Sidebar**       | Click any wireframe to view it          |
| **← / →** buttons | Previous / Next wireframe               |
| **Counter**       | Shows current position (e.g., "5 / 38") |

### Keyboard Shortcuts

#### Navigation

| Key             | Action                                          |
| --------------- | ----------------------------------------------- |
| `←` / `→`       | Previous / Next wireframe                       |
| `Shift+F1`–`F9` | Jump to category (Foundation, Core, Auth, etc.) |
| `Ctrl+1`–`7`    | Jump to feature within current category         |
| `1`–`9`         | Jump to spec within current feature             |

#### Zoom & Pan

| Key       | Action                       |
| --------- | ---------------------------- |
| `↑` / `↓` | Zoom in / out                |
| `+` / `-` | Zoom in / out                |
| `0`       | Fit to view (dynamic sizing) |

#### Display Modes

| Key      | Action                                       |
| -------- | -------------------------------------------- |
| `F`      | Toggle focus mode (hides sidebar and footer) |
| `L`      | Toggle legend drawer (shows reference info)  |
| `Escape` | Exit focus mode / close legend               |

### Mouse Controls

| Action           | Effect                           |
| ---------------- | -------------------------------- |
| **Scroll wheel** | Zoom in/out (centered on cursor) |
| **Click + drag** | Pan the wireframe                |
| **Click zoom %** | Fit to view                      |

### URL Hash Navigation

Link directly to any wireframe using a URL hash:

```
index.html#002-cookie-consent/01-consent-modal.svg
```

---

## Understanding the Interface

### Status Badges

Status emojis appear next to features and wireframes in the sidebar:

| Emoji | Status       | Meaning             |
| ----- | ------------ | ------------------- |
| 📝    | draft        | Initial creation    |
| 🔄    | regenerating | Being rebuilt       |
| 👁️    | review       | Awaiting review     |
| 🔴    | issues       | Problems found      |
| 🟡    | patchable    | Minor fixes needed  |
| ✅    | approved     | Passed all checks   |
| 📋    | planning     | Spec being analyzed |
| 🚧    | inprogress   | Work underway       |
| ⛔    | blocked      | Cannot proceed      |

Status is loaded from `wireframe-status.json`.

### Legend Drawer (press `L`)

The legend explains wireframe annotation conventions:

#### Tag Colors (Colorblind-Friendly)

| Color            | Border | Tag    | Meaning                |
| ---------------- | ------ | ------ | ---------------------- |
| Blue `#2563eb`   | Solid  | **FR** | Functional Requirement |
| Orange `#ea580c` | Dashed | **SC** | Success Criteria       |
| Cyan `#0891b2`   | Dotted | **US** | User Story             |

#### RLS Access Palette

| Symbol | Background     | Meaning                        |
| ------ | -------------- | ------------------------------ |
| ✓      | Blue           | Allow – Operation permitted    |
| ✗      | Red striped    | Deny – Operation blocked       |
| ?      | Yellow dashed  | Conditional – Row-filtered     |
| 🔑     | Purple         | Auth Role – Authenticated user |
| ⚙     | Magenta double | Service Role – Backend bypass  |

#### Common Abbreviations

| Abbr | Full Term                            |
| ---- | ------------------------------------ |
| RLS  | Row Level Security                   |
| GDPR | General Data Protection Regulation   |
| WCAG | Web Content Accessibility Guidelines |
| a11y | Accessibility                        |
| PWA  | Progressive Web App                  |
| E2E  | End-to-End (encryption/testing)      |

---

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

---

## Wireframe Structure

```
000-landing-page/          Landing page wireframes
001-wcag-aa-compliance/    Accessibility dashboard
002-cookie-consent/        Cookie consent flows
...
includes/                  Shared SVG components (headers, footers)
```

Each feature folder contains:

- `01-*.svg`, `02-*.svg` ... numbered wireframe files
- `*.issues.md` validation issues (if any)

---

## Creating Your Own Wireframes

1. Create SVG files in feature folders (e.g., `017-your-feature/`)
2. Add navigation entries in `index.html`:
   - Add to the appropriate category section in the sidebar
   - Add entry to the `wireframes` array in the script
3. Follow patterns from existing wireframes

### SVG Requirements

| Property         | Value                     |
| ---------------- | ------------------------- |
| Canvas           | `viewBox="0 0 1920 1080"` |
| Desktop mockup   | x=40, y=60, 1280×720      |
| Mobile mockup    | x=1360, y=60, 360×720     |
| Panel background | `#e8d4b8` (never white)   |
| Touch targets    | 44px minimum              |

---

## Troubleshooting

### Wireframe not loading

- Check the browser console for errors
- Verify the SVG file path matches the `data-svg` attribute in `index.html`
- Ensure the SVG file exists and is valid XML

### External references not resolving

The viewer resolves `<use href="includes/file.svg#id">` references automatically.

- External SVGs must be in the `includes/` directory or same folder
- Path traversal (`..`) is blocked for security

### Zoom/pan not working

- Click and drag requires starting on the SVG, not on links
- Scroll wheel zoom centers on cursor position
- Press `0` to reset to fit-to-view

### Status badges not showing

- Check that `wireframe-status.json` exists and is valid JSON
- Reload the page to fetch fresh status

### Focus mode stuck

- Press `F` or `Escape` to exit focus mode
- Refresh the page if keys aren't responding

---

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

---

## Development

Start the dev server with hot reload:

```bash
npm install
npm run dev
```

The viewer includes:

- **Hot reload**: Browser refreshes when SVG files change
- **SVG sanitization**: Scripts and event handlers stripped for security
- **External ref resolution**: `<use>` elements with external hrefs are inlined
- **CSP headers**: Content Security Policy prevents XSS attacks

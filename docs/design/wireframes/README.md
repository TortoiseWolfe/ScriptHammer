# FirstFrame Wireframes

Example wireframes demonstrating the FirstFrame template structure.

## Viewing Wireframes

Open `index.html` in a browser to view all wireframes with navigation.

### Features
- Sidebar with clickable index
- Previous/Next navigation buttons
- Keyboard navigation (Left/Right for prev/next, Up/Down for zoom)
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

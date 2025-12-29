---
description: Start the SVG wireframe viewer with hot reloading at localhost:3333 (user)
---

Start the interactive wireframe viewer with live reload.

## Instructions

1. **Install dependencies** (if needed):

```bash
cd docs/design/wireframes && npm install
```

2. **Start the viewer**:

```bash
cd docs/design/wireframes && npm run dev
```

This starts `live-server` on port 3333 with automatic hot reloading when SVG files change.

## Viewer Features

- **Navigation**: Click sections in sidebar or use Left/Right arrow keys
- **Zoom**: Up/Down arrows or +/- keys (0 resets to 85%)
- **Hot reload**: Changes to SVGs auto-refresh in browser

## URL

Open http://localhost:3333 in your browser.

## Stop

Press `Ctrl+C` in the terminal to stop the server.

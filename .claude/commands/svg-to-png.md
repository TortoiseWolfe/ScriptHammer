---
description: Convert all SVG wireframes to PNG images (1200x800) (project)
---

Convert all wireframes from `index.html` to numbered PNG files.

## Instructions

1. **Start a Docker file server** mounting the wireframes directory:

```bash
mkdir -p docs/design/wireframes/png
docker run -d --name wireframe-server \
  -v $(pwd)/docs/design/wireframes:/srv \
  -w /srv python:3-alpine python -m http.server 8080
```

2. **Get the container IP**:

```bash
docker inspect wireframe-server --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

3. **Set browser viewport to 1200x800** using `mcp__MCP_DOCKER__browser_resize`

4. **Capture all wireframes** using `mcp__MCP_DOCKER__browser_run_code` with the wireframes array from `index.html`:

```javascript
const wireframes = [
  // Extract from index.html - format: { path: 'folder/file.svg', name: 'NN-name' }
];

await page.setViewportSize({ width: 1200, height: 800 });

for (const wf of wireframes) {
  await page.goto(`http://CONTAINER_IP:8080/${wf.path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `/tmp/playwright-output/${wf.name}.png`, type: 'png' });
}
```

5. **Copy PNGs** from browser container to local folder:

```bash
docker ps | grep playwright  # Find browser container name
docker cp BROWSER_CONTAINER:/tmp/playwright-output/. docs/design/wireframes/png/
```

6. **Clean up**:

```bash
docker rm -f wireframe-server
```

## Why This Works

The MCP browser runs in Docker and cannot access local files or host localhost. By serving files from another Docker container on the same bridge network, the browser can reach them.

## Output

`docs/design/wireframes/png/{NN}-{name}.png` at 1200x800 resolution.

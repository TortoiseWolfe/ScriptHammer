# Docker Configuration Audit

**Date**: 2026-01-16
**Reviewer**: Docker Captain
**Scope**: All Docker-related files in ScriptHammer

---

## Summary

| File                            | Security | Efficiency | Production Ready |
| ------------------------------- | -------- | ---------- | ---------------- |
| `Dockerfile.review`             | 4/10     | 6/10       | No               |
| `wireframes/docker-compose.yml` | 7/10     | 7/10       | Partial          |
| `.speckit/docker-compose.yml`   | 3/10     | 5/10       | No               |

**Critical Finding**: No `.dockerignore` files exist anywhere in the project.

---

## 1. Dockerfile.review

**Location**: `docs/design/wireframes/Dockerfile.review`

### Security Issues

| Issue                          | Severity | Line                |
| ------------------------------ | -------- | ------------------- |
| Running as root                | HIGH     | (no USER directive) |
| No signal handling (tini)      | MEDIUM   | L29                 |
| Global npm install as root     | MEDIUM   | L16                 |
| COPY . . without .dockerignore | MEDIUM   | L26                 |

### Efficiency Issues

| Issue                           | Impact                           |
| ------------------------------- | -------------------------------- |
| Base image is large (~2GB)      | Slow pulls, large attack surface |
| Separate RUN layers             | Missed cache optimization        |
| npm install without cache clean | Bloated layer                    |

### What's Good

- ✓ Version pinning: `playwright==1.57.0` matches base image
- ✓ Apt cache cleanup: `rm -rf /var/lib/apt/lists/*`
- ✓ Clear usage documentation in comments

### Recommended Dockerfile.review

```dockerfile
# syntax=docker/dockerfile:1

# Wireframe Review Docker Image
# Usage:
#   docker compose build review
#   docker compose run review 002

FROM mcr.microsoft.com/playwright/python:v1.57.0-noble

# Install Node.js + live-server, clean up in same layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    tini \
    && npm install -g live-server \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright Python package - MUST match base image version
RUN pip install --no-cache-dir playwright==1.57.0

# Create non-root user for running the app
RUN useradd -m -s /bin/bash reviewer
USER reviewer

WORKDIR /wireframes

# Copy with correct ownership (will be overridden by volume mount in dev)
COPY --chown=reviewer:reviewer . .

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--", "python3", "screenshot-wireframes.py"]
CMD ["--help"]
```

---

## 2. wireframes/docker-compose.yml

**Location**: `docs/design/wireframes/docker-compose.yml`

### Security Issues

| Issue                      | Severity | Line  |
| -------------------------- | -------- | ----- |
| No `init: true` for viewer | LOW      | L2-16 |
| Bind mount is read-write   | LOW      | L7    |

### Efficiency Issues

| Issue                                  | Impact                             |
| -------------------------------------- | ---------------------------------- |
| `npx live-server` downloads at runtime | Slower startup, network dependency |

### What's Good

- ✓ Excellent base image: `node:22-bookworm-slim`
- ✓ Comprehensive healthcheck with start_period
- ✓ Restart policy: `unless-stopped`
- ✓ HOST_UID/GID for permission handling

### Recommended Changes

```yaml
services:
  viewer:
    image: node:22-bookworm-slim
    init: true # ADD: proper signal handling
    ports:
      - '3000:3000'
    volumes:
      - .:/app:ro # CHANGE: read-only for viewer
    working_dir: /app
    command: npx live-server --port=3000 --host=0.0.0.0
    healthcheck:
      test:
        [
          'CMD',
          'node',
          '-e',
          "require('http').get('http://127.0.0.1:3000', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    restart: unless-stopped

  review:
    build:
      context: .
      dockerfile: Dockerfile.review
    init: true # ADD: proper signal handling
    volumes:
      - .:/wireframes:rw
    environment:
      - HOST_UID=${UID:-1000}
      - HOST_GID=${GID:-1000}
```

---

## 3. .speckit/docker-compose.yml

**Location**: `.speckit/docker-compose.yml`

### Security Issues

| Issue                       | Severity | Line                |
| --------------------------- | -------- | ------------------- |
| Running as root             | HIGH     | (no user directive) |
| Parent directory bind mount | MEDIUM   | L5                  |
| No resource limits          | LOW      | -                   |

### Efficiency Issues

| Issue             | Impact                       |
| ----------------- | ---------------------------- |
| No healthcheck    | Cannot verify service health |
| No restart policy | Won't recover from crashes   |

### What's Good

- ✓ Uses slim image: `python:3.12-slim`
- ✓ Proper PATH configuration

### Recommended Changes

```yaml
services:
  speckit:
    image: python:3.12-slim
    user: '1000:1000' # ADD: non-root user
    volumes:
      - ..:/workspace:rw
    working_dir: /workspace
    environment:
      - UV_TOOL_DIR=/workspace/.speckit
      - UV_TOOL_BIN_DIR=/workspace/.speckit/bin
      - PATH=/workspace/.speckit/bin:/usr/local/bin:/usr/bin:/bin
    # ADD: resource limits
    deploy:
      resources:
        limits:
          memory: 512M
```

---

## 4. Missing .dockerignore

**Critical**: No `.dockerignore` files found. The `COPY . .` in Dockerfile.review copies:

- `.git/` directory (large, contains secrets potentially)
- All `png/` screenshot directories (hundreds of MB)
- All `*.issues.md` files
- `node_modules/` if present
- `.env` files if present

### Required: docs/design/wireframes/.dockerignore

```
# Git
.git
.gitignore

# Output artifacts
png/
*.png

# Documentation
*.md
!README.md

# Docker files (don't copy into image)
Dockerfile*
docker-compose*
compose.yaml
.dockerignore

# Development
node_modules
npm-debug.log
.env*

# Python
__pycache__
*.pyc
.pytest_cache

# IDE
.vscode
.idea
```

---

## Action Items

### Priority 1 (Security)

| Task                 | File                      | Impact                         |
| -------------------- | ------------------------- | ------------------------------ |
| Create .dockerignore | `docs/design/wireframes/` | Prevents leaking .git, secrets |
| Add USER directive   | `Dockerfile.review`       | Non-root execution             |
| Add `init: true`     | Both compose files        | Proper signal handling         |

### Priority 2 (Best Practices)

| Task                        | File                            | Impact             |
| --------------------------- | ------------------------------- | ------------------ |
| Add tini to Dockerfile      | `Dockerfile.review`             | Graceful shutdown  |
| Add healthcheck             | `.speckit/docker-compose.yml`   | Service monitoring |
| Make viewer mount read-only | `wireframes/docker-compose.yml` | Defense in depth   |

### Priority 3 (Optimization)

| Task                | File                          | Impact                    |
| ------------------- | ----------------------------- | ------------------------- |
| Combine RUN layers  | `Dockerfile.review`           | Smaller image             |
| Add resource limits | `.speckit/docker-compose.yml` | Prevent runaway processes |

---

## Quick Validation Commands

```bash
# Check if containers run as non-root
docker compose run --rm viewer whoami
docker compose run --rm review whoami

# Test signal handling (should exit in <2 seconds)
docker compose up -d viewer
time docker compose stop viewer

# Check image size
docker images | grep -E 'wireframe|speckit'

# Scan for CVEs
docker scout cves wireframes-review:latest
```

---

**Next Review**: After fixes applied

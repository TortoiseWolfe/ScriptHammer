# Node.js Rocks in Docker, 2023 Edition

**Bret Fisher - DockerCon 2023**
November 2023 - 45 minutes
Source: https://www.youtube.com/watch?v=GEPW008G250
GitHub: https://github.com/BretFisher/nodejs-rocks-in-docker

---

## Overview

This talk covers four main areas plus a production checklist:
1. **Dockerfile best practices** - Beyond basic 101 internet advice
2. **Base images** - New recommendations including zero-CVE options
3. **Process startup and shutdown** - Init processes and signals
4. **Compose updates** - New features for local development

---

## Dockerfile Best Practices

### Common Mistakes in Internet Examples

Every Docker 101 blog post gets things wrong:
- Using `node:latest` (never use this)
- Running as root user
- Copying everything in one command
- Not pinning image versions

### Improved Day-One Dockerfile

**Use Tier 1 supported builds.** The Node project has tier rankings:
- **Tier 1:** Production-ready, support contracts available
- **Tier 2:** Best effort support
- **Experimental:** May work, no guarantees

**Alpine is set to experimental.** Don't use `node:alpine` in production—musl and busybox cause problems at scale.

### Key Dockerfile Updates (2023)

**Pin images with SHA hash:**
```dockerfile
FROM node:20-bookworm-slim@sha256:abc123...
```
The tag is for humans; the SHA hash guarantees the exact image.

**WORKDIR now assigns permissions based on USER:**
```dockerfile
USER node
WORKDIR /app  # Automatically gets node user permissions
```
No more manual `mkdir` and `chown` commands needed.

**Use `--chown` on COPY commands:**
```dockerfile
COPY --chown=node:node package*.json ./
```

**Updated npm ci syntax:**
```dockerfile
RUN npm ci --omit dev
```
The `--only=production` flag is deprecated.

**Don't use npm to start your app:**
```dockerfile
# BAD
CMD ["npm", "start"]

# GOOD
CMD ["node", "server.js"]
```

### Opinion Change: Security Scanning

**No longer recommend audit stages in Dockerfile.** CI tools (GitHub Actions, GitLab) have better native support for npm audits and CVE scans. Keep your Dockerfile simpler.

---

## docker init

**New CLI command for scaffolding Docker projects.**

```bash
docker init
```

Creates three files:
- `.dockerignore`
- `Dockerfile`
- `compose.yaml` (new standard filename, not `docker-compose.yml`)

**Caution:** `docker init` defaults to Alpine images—consider changing to slim.

### BuildKit Frontend Syntax

The generated Dockerfile includes:
```dockerfile
# syntax=docker/dockerfile:1
```

This guarantees all team members and CI have the same feature support when using BuildKit (now the default builder).

**BuildKit cache mounts** for npm:
```dockerfile
RUN --mount=type=cache,target=/root/.npm npm ci
```
Caches downloaded packages (not node_modules) to save internet trips on rebuilds.

---

## Base Image Selection

### Never Use These

| Image | Problem |
|-------|---------|
| `node:latest` | Unpredictable, tons of CVEs |
| `node:20` (non-slim) | Has ImageMagick, build tools, 800+ CVEs |
| `node:alpine` | Experimental tier, musl/busybox issues |

### CVE Scanner Comparison

**Commercial scanners (Docker Scout, Snyk) have fewer false positives** than open-source scanners. They're fixing issues faster.

**Docker Scout** is new and improving rapidly—not perfect yet but recommended.

### Recommended Base Images (2023)

#### Option 1: Official Slim (Easiest)
```dockerfile
FROM node:20-bookworm-slim
```
- No critical/high CVEs (per Snyk and Docker Scout)
- Everything you need to run Node
- Good default choice

#### Option 2: Ubuntu + Side-loaded Node (Most Secure)
```dockerfile
FROM node:20 AS node
FROM ubuntu:22.04

COPY --from=node /usr/local/bin/node /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
```
- 69MB base image
- No highs or criticals
- Snyk detects side-loaded binaries; Docker Scout doesn't (yet)

**Define both images at top for version tracking:**
```dockerfile
ARG NODE_IMAGE=node:20
ARG BASE_IMAGE=ubuntu:22.04

FROM ${NODE_IMAGE} AS node
FROM ${BASE_IMAGE}
# ... copy binaries
```

#### Option 3: Chainguard/Wolfi (Zero CVE)
```dockerfile
FROM cgr.dev/chainguard/node:latest
```
- **Zero CVEs** across the board
- Free tier available, paid for pinned versions
- Very small, no shell
- Requires advanced Dockerfile knowledge
- Use SHA hash for pinning on free tier

**Chainguard** redesigns official images from scratch to eliminate vulnerabilities. Highly recommended for teams ready for advanced images.

---

## Process Management

### Do You Need Tini?

**Use Tini in most cases** as the init process to start Node.

**You can skip Tini if BOTH are true:**
1. Your app doesn't create subprocesses (most Node apps don't)
2. Your app listens for signals in code AND you're on Kubernetes with `shareProcessNamespace: true`

**Kubernetes pause container trick:** Enable `shareProcessNamespace` and the pause container handles zombie reaping and signal processing for you.

### The 10-Second Diagnostic

**If your container takes 10 seconds to stop, you have an init problem.**

Docker waits 10 seconds (Kubernetes waits 30) for graceful shutdown, then force-kills. If Node isn't hearing SIGTERM, it gets killed.

**Solution:** Use Tini or handle signals in your code.

---

## Compose Updates (2023)

### No More Version Field

```yaml
# OLD - don't do this anymore
version: "3.8"

# NEW - just remove it
services:
  app:
    ...
```

All V2 and V3 features are now available together. Only Swarm still needs V3.

### depends_on with Health Checks

**Wait for database to be ready, not just started:**

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Chain dependencies: frontend → API → database. Docker Compose waits for each health check to pass.

### includes, extends, and CLI Overrides

**includes** - Import other compose files:
```yaml
include:
  - ./db/compose.yaml
  - ./redis/compose.yaml
```

**CLI overrides** - Personal development settings:
```yaml
# compose.override.yaml (gitignored)
services:
  app:
    ports:
      - "3001:3000"  # Different port for this developer
```

### Compose Watch (New in 2023)

**Replaces bind mounts for development.** Avoids cross-OS performance issues on Mac/Windows.

```yaml
services:
  app:
    build: .
    develop:
      watch:
        - action: rebuild
          path: package.json
        - action: sync
          path: ./src
          target: /app/src
```

**How it works:**
- `rebuild` - Rebuilds image when file changes (use for package.json)
- `sync` - Copies changed files into running container (use for source code)

```bash
docker compose watch
```

Replaces `docker compose up`. Watches for changes, syncs files or rebuilds automatically.

**Still need nodemon** inside the container to restart Node when synced files change.

### New Compose Commands

| Command | Purpose |
|---------|---------|
| `docker compose ls` | List all running Compose projects |
| `docker compose alpha publish` | Push compose files to registry as deployable artifacts |

---

## Production Checklist

### Dockerfile

- [ ] `.dockerignore` file (copy `.gitignore`, add `node_modules`)
- [ ] Running as `node` user (non-root)
- [ ] Using Tini or another init process
- [ ] Calling `node` directly (not npm/yarn/pm2/nodemon)
- [ ] Health check defined
- [ ] Using `npm ci --omit dev`

### Source Code

- [ ] Capture SIGTERM and SIGINT signals
- [ ] Handle proper graceful shutdown
- [ ] Use `stoppable` package for HTTP connection tracking
- [ ] Send FIN packets for zero-downtime deploys
- [ ] Check file permissions on startup (if doing file I/O)
- [ ] Provide `/health` endpoint (or write health to file for non-HTTP apps)

### Kubernetes Pods

- [ ] Liveness and readiness probes
- [ ] `terminationGracePeriodSeconds` configured
- [ ] `privileged: false`
- [ ] `allowPrivilegeEscalation: false`
- [ ] Running as non-root user
- [ ] seccomp profiles enabled (disabled by default in K8s)

---

## Summary

**2023 Changes:**
1. **docker init** - New scaffolding command
2. **Chainguard/Wolfi** - Zero-CVE base images
3. **Docker Scout** - New CVE scanner
4. **Compose Watch** - Replaces bind mounts for dev
5. **No compose version** - All features available
6. **WORKDIR permissions** - Automatic based on USER
7. **npm ci --omit dev** - New syntax

**Base Image Recommendations:**
1. `node:20-bookworm-slim` - Easy, official
2. Ubuntu + side-loaded Node - Most secure
3. Chainguard/Wolfi - Zero CVE (advanced)

**Never use:** `node:latest`, non-slim, Alpine

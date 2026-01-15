# Node.js Rocks in Docker

**Bret Fisher - DockerCon 2022**
Source: https://youtu.be/Z0lpNSC1KbM
Examples: https://github.com/BretFisher/nodejs-rocks-in-docker

---

## Overview

This talk covers:
- **Base image selection** - Finding the best, securest, smallest Node image
- **Dockerfile best practices** - Security and optimization patterns
- **PID1 and Tini** - Why Node shouldn't run as PID1
- **Multi-stage builds** - One Dockerfile for dev, test, and production

---

## Base Image Selection

### Why NOT to Use node:latest

- Contains unnecessary packages (ImageMagick, Subversion, Mercurial)
- **800+ CVEs** in a single image
- Only useful for first-day Docker learning

### Why NOT to Use Alpine

**Node team considers Alpine experimental** - not Tier 1 support like Debian/Ubuntu/CentOS.

**Size isn't a reason to pick Alpine:**
- Slim Debian images are the same size
- Distroless is actually smaller than Alpine

**Package pinning problems:**
- APK packages aren't reliably pinnable
- Old versions fall off the package manager
- Leads to broken builds over time

**Production failure stories:**
- Alpine-specific Node issues that can only be fixed by switching to Debian/Ubuntu

### Why NOT to Use node:16 (without slim)

- **Nearly 2,000 CVEs** found with Trivy scanner
- Always use **slim variants or better**

### Understanding Debian Version Pinning

When Node releases a major version (e.g., Node 16), it pins to the current Debian LTS version at that time.

**Problem:** Node 16 slim uses Debian 10 (Buster), but Debian 11 (Bullseye) is current.
- Default Node 16 = Debian 10 = **131 CVEs**
- Node 16 Bullseye Slim = Debian 11 = fewer CVEs

**Solution:** Manually select the newest Debian version in your tag:
```dockerfile
FROM node:16-bullseye-slim
```

Debian codenames in tags (Buster, Bullseye) indicate the Debian version. **Always choose the newest.**

---

## Building Your Own Base Image

### Option 1: Ubuntu + Copy Node Binaries (Recommended)

Ubuntu has **fewer CVEs than Debian** historically and patches faster.

**Three ways to get Node on Ubuntu:**

| Method | Problem |
|--------|---------|
| `apt install nodejs` | Installs Node 10 (ancient) |
| NodeSource package | Installs Python 3 + extras (adds CVEs) |
| **Copy from Node image** | Clean, minimal, no extras |

**Copy-in approach:**
```dockerfile
# Define Node version once
FROM node:16-bullseye-slim AS node

# Switch to Ubuntu
FROM ubuntu:focal-20220401

# Copy only Node binaries
COPY --from=node /usr/local /usr/local
COPY --from=node /opt /opt

# Enable package managers
RUN corepack disable && corepack enable
```

**Result:** Zero high/critical CVEs, only 15 medium/low (vs 12 high + 74 medium in node:16-bullseye-slim).

### Option 2: Distroless

Google's distroless images remove shells, package managers, and everything non-essential.

**Stats:**
- Only **2,000 files** vs 180,000 in standard images
- **108 MB** - smaller than Alpine (111 MB)

**Limitations:**
- Can only be used as the **final stage** (no shell for debugging)
- Only pin to **major versions** (no minor/patch pinning)
- Based on Debian, so inherits some Debian CVEs

**Usage pattern:**
```dockerfile
# Dev/test stages use standard Node image
FROM node:16-slim AS build
# ... build steps ...

# Production uses distroless
FROM gcr.io/distroless/nodejs:16 AS production
COPY --from=build /app /app
```

### Base Image Recommendations (Ranked)

1. **node:XX-bullseye-slim** - Easy, official, good security
2. **Ubuntu + copy Node binaries** - Fewer CVEs, more control
3. **Distroless** - Smallest, but limited pinning

---

## Dockerfile Best Practices

### Essential .dockerignore

Copy your `.gitignore` and add:
```
.git
node_modules
```

### Use npm ci for Production

```dockerfile
RUN npm ci --only=production
```

**Why `npm ci`:**
- Installs exact versions from lock file
- Reproducible builds
- No unexpected version changes

**Why `--only=production`:**
- Excludes dev dependencies
- Reduces CVE surface area
- Smaller image size

### Run as Non-Root User

```dockerfile
# Create app directory with correct ownership
RUN mkdir -p /app && chown node:node /app
WORKDIR /app

# Switch to non-root user
USER node

# Copy files with correct ownership
COPY --chown=node:node package*.json ./
RUN npm ci --only=production
COPY --chown=node:node . .
```

**Note:** Official Node images include a pre-created `node` user. Ubuntu/Distroless requires creating it manually.

---

## PID1 and Tini

### The Problem

**Node wasn't designed to run as PID1** (the init process in Linux).

When Node runs as PID1:
- Can't properly handle Linux signals (SIGTERM, SIGINT)
- Creates zombie processes that can't be reaped
- Health check exec probes can spawn orphaned processes

### The Solution: Tini

**Tini** is a tiny init process that:
- Properly forwards signals to Node
- Reaps zombie processes
- Prevents health check process accumulation

```dockerfile
# Install tini
RUN apt-get update && apt-get install -y tini

# Set as entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run node directly (not npm)
CMD ["node", "server.js"]
```

### Don't Use npm start

**Problems with `npm start` in containers:**
- npm can't forward signals properly
- Adds unnecessary wrapper process
- Use `node server.js` directly instead

---

## Multi-Stage Builds

### Philosophy

**One Dockerfile for everything:** dev, test, and production.

Each environment has different needs, but shares a common base. Multi-stage builds let you diverge without separate Dockerfiles.

### Stage Pattern

```
base → dev (local development)
     → source → test (CI/CD)
              → prod (production)
```

### Example: Base + Dev + Prod

```dockerfile
# Stage 1: Base (production dependencies only)
FROM node:18-bullseye-slim AS base
RUN apt-get update && apt-get install -y tini
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci --only=production
USER node

# Stage 2: Dev (extends base with dev deps)
FROM base AS dev
ENV NODE_ENV=development
RUN npm install
CMD ["nodemon", "server.js"]

# Stage 3: Production (final image)
FROM base AS prod
COPY --chown=node:node . .
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
```

**Key insight:** Production stage comes FROM base, not FROM dev. Dev dependencies never touch production.

### Example: With Test Stage

```dockerfile
# Base stage - production deps only, no source code
FROM node:18-bullseye-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Dev stage - adds dev dependencies
FROM base AS dev
RUN npm install
CMD ["nodemon"]

# Source stage - adds source code
FROM base AS source
COPY . .

# Test stage - runs tests with dev deps
FROM source AS test
COPY --from=dev /app/node_modules ./node_modules
RUN npm run lint
RUN npm test

# Prod stage - ships exact tested source
FROM source AS prod
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
```

**Critical pattern:** The `source` stage is what gets tested AND shipped. No separate copy of source code for production.

### Why Structure Matters

**Default builds produce production images:**
- Building without `--target` processes top-down
- Final stage (prod) is the default output
- Dev stage only built when explicitly targeted

**Ship what you tested:**
- Production stage copies FROM source (same files that were tested)
- No additional npm install or file copies
- Only metadata changes (ENTRYPOINT, CMD)

---

## Quick Reference

### Recommended Base Images

| Choice | CVEs | Size | Notes |
|--------|------|------|-------|
| node:XX-bullseye-slim | ~80 | 180MB | Easy, official |
| Ubuntu + Node copy | ~15 | 150MB | Most secure |
| Distroless | ~13 | 108MB | No shell, major-only pins |

### Dockerfile Checklist

- [ ] Use bullseye-slim or newer Debian version
- [ ] Add `.dockerignore` with `.git` and `node_modules`
- [ ] Use `npm ci --only=production` for prod
- [ ] Run as non-root user (`USER node`)
- [ ] Use `--chown=node:node` on COPY commands
- [ ] Install and use Tini as entrypoint
- [ ] Run `node` directly, not `npm start`
- [ ] Structure multi-stage for dev/test/prod
- [ ] Ship the exact source that was tested

---

## Resources

- **Examples repo:** https://github.com/BretFisher/nodejs-rocks-in-docker
- **Weekly live show:** bret.live
- **Discord:** devops.fan (10,000+ members)
- **Courses/blog:** bretfisher.com

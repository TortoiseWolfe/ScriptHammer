# Docker and Node.js Best Practices

**Bret Fisher - DockerCon 2019**
Source: https://youtu.be/Zgx0o8QjJk4
Examples: https://github.com/BretFisher/dockercon19

---

## Overview

This talk covers:
- **Dockerfile best practices** for Node.js
- **Multi-stage builds** for dev, test, and production
- **Security scanning** with npm audit and CVE scanners
- **Proper shutdown** and signal handling
- **Docker Compose** patterns for local development
- **HTTP connection management** for zero-downtime deployments

---

## Base Image Selection

### Three Options in Official Node Repo

| Image | Size (Node 12) | Use Case |
|-------|----------------|----------|
| Default | ~900 MB | Has all build tools (node-gyp, etc.) |
| **Slim** | ~150 MB | Production - no build tools |
| Alpine | ~77 MB | Not recommended for most projects |

### Why NOT Alpine

**Size difference is minimal** - Slim is only ~70 MB larger than Alpine. On a server, this doesn't matter.

**Alpine quirks:**
- Uses different C libraries (musl vs glibc)
- Nodemon file watching issues on Alpine
- CVE scanning databases are incomplete for Alpine
- Not a traditional Linux distribution

**Recommendation:** Start with **slim** for production, use default only if you need to compile native modules.

### Debian Version Matters

Official images use Debian underneath. Use the latest Debian version (was Stretch in 2019) for:
- Better security scanning results
- Latest package updates
- Fewer known vulnerabilities

---

## Essential Dockerfile Practices

### 1. Use .dockerignore

Copy your `.gitignore` and ensure it includes:
```
.git
node_modules
tests
logs
```

**Critical:** Never copy host `node_modules` into the container. Mac/Windows binaries won't work in Linux containers.

### 2. Enable the Node User

Every official Node image includes a `node` user (disabled by default).

```dockerfile
# After apt-get/apk and global installs (require root)
USER node

# Before npm install of your app
COPY --chown=node:node package*.json ./
RUN npm ci --only=production
COPY --chown=node:node . .
```

**Order matters:**
1. Root-required commands (apt-get, npm install -g)
2. `USER node`
3. App-specific npm install
4. Copy source code

### 3. Don't Use npm start

**npm start is an anti-pattern in containers.**

Problems with npm:
- Doesn't forward Linux signals (SIGTERM, SIGINT)
- Adds unnecessary wrapper process
- Can't handle graceful shutdown

**Use node directly:**
```dockerfile
CMD ["node", "server.js"]
```

---

## Proper Shutdown and Signal Handling

### The Problem

If `docker stop` takes 10 seconds, your app isn't listening to signals. Docker waits 10 seconds then kills the process. Kubernetes waits 30 seconds.

### Three Solutions

#### Option 1: docker run --init (Temporary)

```bash
docker run --init my-node-app
```

Adds Tini as init process. Good for running other people's apps.

#### Option 2: Add Tini to Dockerfile

```dockerfile
# Alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# Debian
RUN apt-get update && apt-get install -y tini
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
```

#### Option 3: Handle Signals in Code (Recommended)

**Basic signal handling:**
```javascript
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
```

**Better: Use stoppable package**

The `stoppable` npm package tracks connections and sends FIN packets to clients, enabling true zero-downtime deployments.

```javascript
const stoppable = require('stoppable');
const server = stoppable(http.createServer(app));
```

---

## Multi-Stage Builds

### Why Multi-Stage?

- Keep dev dependencies out of production images
- Run tests during build
- Single Dockerfile for all environments
- Ship exactly what you tested

### Stage Structure

```dockerfile
# Stage 1: Base (production dependencies)
FROM node:18-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Dev (adds dev dependencies)
FROM base AS dev
RUN npm install
ENV NODE_ENV=development
CMD ["nodemon"]

# Stage 3: Source (adds source code)
FROM base AS source
COPY . .

# Stage 4: Test (combines source + dev deps)
FROM source AS test
COPY --from=dev /app/node_modules ./node_modules
RUN npm run lint
RUN npm test

# Stage 5: Audit (security scanning)
FROM test AS audit
USER root
RUN npm audit --audit-level=critical
# Add CVE scanner here (e.g., Aqua Trivy)

# Stage 6: Production (clean, tested image)
FROM source AS prod
CMD ["node", "server.js"]
```

### Building Specific Stages

```bash
# Build only production
docker build --target prod -t myapp:prod .

# Build with tests (CI)
docker build --target test -t myapp:test .

# Build with security audit
docker build --target audit -t myapp:audit .
```

### Key Insight

**Test what you ship:** The production stage comes FROM source (the tested code), not from a fresh build. This ensures you deploy exactly what was tested.

---

## Security Scanning

### npm audit

```dockerfile
FROM test AS audit
USER root
RUN npm audit --audit-level=critical
```

**Start with `--audit-level=critical`** - there's always something in npm audit. Don't let non-critical issues fail your build initially.

### CVE Scanners

Add a CVE scanner stage (e.g., Aqua Security's Trivy):
- Scans for known Linux, Node, and npm vulnerabilities
- Different scanners report different results
- Consider multiple scanners for security-critical apps

---

## Docker Compose for Development

### Compose File Versions

**Version 2:** Ideal for local dev/test (has `depends_on` with health checks)
**Version 3:** For Swarm/Kubernetes compatibility

If you're not using Swarm or Kubernetes, **use version 2**.

### node_modules Solutions

**Problem:** Host node_modules (Mac/Windows) are incompatible with Linux containers.

#### Solution 1: Install in Container (Most Common)

```bash
# First time setup
docker compose run --rm app npm install

# Then start normally
docker compose up
```

**Never run `npm install` on host** - it creates Mac/Windows binaries.

#### Solution 2: Move node_modules Up a Directory

Node looks for `node_modules` up the path. Move it up a directory in the container:

```dockerfile
WORKDIR /app
# node_modules installed at /node_modules, not /app/node_modules
```

```yaml
volumes:
  - .:/app
  - /app/node_modules  # Empty volume hides host node_modules
```

This allows developing on host OR in container without conflicts. **Not all frameworks support this.**

### Performance: Use Delegated Mounts (Mac)

```yaml
volumes:
  - .:/app:delegated
```

**Always add `:delegated`** on Mac for much faster bind mount performance.

### Windows: Enable Polling

Windows doesn't have file system events for bind mounts. Enable polling in nodemon:

```json
{
  "legacyWatch": true
}
```

### Startup Order with depends_on

**Compose v2 only** - Use `depends_on` with health checks:

```yaml
version: "2.4"
services:
  app:
    build:
      context: .
      target: dev
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

Docker waits for `db` health check to pass before starting `app`.

---

## Production Checklist

- [ ] Use `node` directly as CMD (not npm start)
- [ ] Add `.dockerignore` with `.git` and `node_modules`
- [ ] Capture SIGTERM for graceful shutdown
- [ ] Use `npm ci --only=production`
- [ ] Run as non-root user (`USER node`)
- [ ] Add npm audit to build pipeline
- [ ] Add CVE scanner stage
- [ ] Implement health checks
- [ ] Use multi-stage builds (test what you ship)

---

## Zero-Downtime Deployment Requirements

1. **Signal handling** - App responds to SIGTERM
2. **Connection tracking** - Use `stoppable` to track HTTP connections
3. **Health checks** - Orchestrator knows when app is ready/unhealthy
4. **Graceful shutdown** - Send FIN packets to existing connections
5. **Long shutdown timeout** - Exceed your longest request time (file uploads, long polling)

**Without health checks, you will have downtime.** Every containerized app needs them.

---

## Resources

- **Examples repo:** https://github.com/BretFisher/dockercon19
- **Health check examples:** Search "docker library healthcheck" on GitHub
- **Weekly YouTube Live:** Search "Bret Fisher" on YouTube
- **Full course:** 9+ hours at bretfisher.com

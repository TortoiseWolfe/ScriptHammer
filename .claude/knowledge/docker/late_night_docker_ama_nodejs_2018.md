# Late Night Docker: AMA Node.js Dockerfile Best Practices

**Bret Fisher - March 2018**
31 minutes
Source: https://www.youtube.com/watch?v=9j03Jlo_dtA
Sample Project: https://github.com/BretFisher/node-docker-good-defaults

---

## Overview

This AMA covers:
- **Layer caching** - Package files before code
- **node_modules problem** - Mac/Windows binaries in Linux containers
- **Signal handling** - Why npm start causes 10-second shutdowns
- **Docker Compose** - nodemon, debug ports, delegated mounts
- **Health checks** - Required for rolling updates

---

## NODE_ENV Handling

**Use ARG for build-time, ENV for runtime:**

```dockerfile
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
```

This allows setting NODE_ENV in Compose or as environment variable, picked up during both build and run.

---

## Layer Caching for Package Managers

**Always copy package files first, then install, then copy code.**

```dockerfile
# Copy package files first (change less often)
COPY package*.json ./

# Install dependencies (cached if packages unchanged)
RUN npm install && npm cache clean --force

# Copy source code last (changes most often)
COPY . .
```

**Why this matters:**
- Each Dockerfile line is a layer
- If a higher line changes, all layers below are rebuilt (cache bust)
- Code changes constantly; packages change rarely
- Without this order, every code change triggers npm install

**Clean up in the same layer.** You can't delete from previous layers—Docker layers are like a stack of pancakes.

---

## node_modules Bind Mount Problem

**The problem:** Mac/Windows node_modules have binaries compiled for the host OS. When you bind mount your app into a Linux container, those binaries won't run.

**Symptoms:**
- `npm install` on Mac, app crashes in container
- Native modules fail silently or with cryptic errors

### Solution: Move node_modules Outside App

Install packages one directory up from your app:

```dockerfile
WORKDIR /opt
COPY package*.json ./
RUN npm install && npm cache clean --force

# Update PATH so binaries are found
ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/app
COPY . .
```

**Result:** node_modules is at `/opt/node_modules`, app is at `/opt/app`. Node automatically looks up the directory tree for modules.

### Solution: Empty Volume Override

In Compose, hide any host node_modules with an empty volume:

```yaml
volumes:
  - .:/opt/app
  - /opt/app/node_modules  # Empty volume hides host modules
```

**How it works:** Volumes don't erase files—they shadow them. If host has node_modules, this mount hides it so the container uses its own Linux-compiled packages.

---

## Why Not npm start

**npm start is an anti-pattern in Docker.**

```dockerfile
# BAD - npm doesn't forward signals
CMD ["npm", "start"]

# GOOD - node receives signals directly
CMD ["node", "index.js"]
```

**The problem:** npm doesn't forward Linux signals (SIGTERM, SIGINT). When Docker tries to stop your container:

1. Docker sends SIGTERM
2. npm ignores it
3. Docker waits 10 seconds
4. Docker sends SIGKILL (forced termination)

**If your containers always take 10 seconds to stop, you have a signaling problem.**

---

## Signal Handling Code

**Handle SIGTERM and SIGINT for graceful shutdown:**

```javascript
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Why this matters for distributed computing:**
- Rolling updates need graceful shutdown
- Without it, you're cutting off users mid-request
- Long polling and WebSockets need connection draining
- This applies whether using Docker, Kubernetes, or AWS ASGs

**Most projects don't do this.** Users get interrupted during every deploy.

---

## Health Checks

**Required for rolling updates in Swarm.**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/health || exit 1
```

**Why:** Docker needs to know when your app is ready, not just started. There's a difference between:
- Binary started
- Binary ready for connections

Node usually starts in seconds. Java/PHP with caching can take minutes.

---

## Docker Compose for Development

### Debug Ports

```yaml
ports:
  - "9229:9229"  # New inspector
  - "5858:5858"  # Legacy debugger
```

Opens ports for VS Code and other debuggers to connect.

### nodemon for File Watching

```yaml
command: nodemon --inspect=0.0.0.0:9229 index.js
```

**Replaces** the Dockerfile CMD for development only. nodemon:
- Watches for file changes
- Restarts node inside the container
- Faster than restarting the container (~0.5-1 second saved)

### Mac Performance: delegated Mounts

```yaml
volumes:
  - .:/opt/app:delegated
```

**Why:** Mac and Windows run containers in a VM. File I/O between host and container has overhead.

**delegated option:**
- Loosens I/O consistency requirements
- Container doesn't wait for host to confirm every write
- Faster npm installs and file operations
- Safe for development (you're just editing files)

**Windows ignores this option**—won't hurt to include for cross-platform teams.

---

## Complete Development Compose Example

```yaml
version: "3"
services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "9229:9229"
    volumes:
      - .:/opt/app:delegated
      - /opt/app/node_modules
    environment:
      - NODE_ENV=development
    command: nodemon --inspect=0.0.0.0:9229 index.js
```

---

## Summary

1. **Layer caching** - Package files first, npm install, then code
2. **Clean in same layer** - npm cache clean in the RUN command
3. **node_modules outside app** - Avoids Mac/Windows binary conflicts
4. **Empty volume override** - Hides host node_modules
5. **Run node directly** - Not npm start (signal forwarding)
6. **Handle SIGTERM** - Graceful shutdown code in every app
7. **Health checks** - Required for rolling updates
8. **delegated mounts** - Mac file I/O performance
9. **nodemon in Compose** - Override CMD for development

# DockTalk: Node.js Docker Best Practices

**Peter McKee - Docker Official Channel**
September 2020 - 59 minutes
Source: https://www.youtube.com/watch?v=JtfDFUMmug0

---

## Overview

This talk covers:
- **Ephemeral containers** - Design for statelessness
- **One process per container** - Why multiple processes cause problems
- **Base image selection** - Tags, slim variants, avoiding latest
- **Layer caching** - Ordering commands for faster builds
- **.dockerignore** - Reducing build context
- **Multi-stage builds** - React/nginx example
- **Graceful shutdown** - SIGTERM handling
- **Don't use npm start** - Run node directly
- **BuildKit** - Faster builds with parallelization

---

## Ephemeral Containers

**Containers should be short-lived and stateless.**

- They can die at any moment and restart without configuration
- If something happens, another container fires up immediately
- Keep all state outside of your containers

**Why stateless matters:**

In a web application, request 1 goes to container A, request 2 might go to container C. If you saved state in container A, container C won't have it.

**Security practice:** Rolling restarts at 2 AM to evict any potential attackers. Not your first line of defense, but limits exposure time.

---

## One Process Per Container

**Best practice: Run only one process inside your container.**

**The problem with multiple processes:**

Before understanding containers, teams often run multiple processes in one container (web server + background workers). If one process dies, it can kill the whole container and cause failures.

**The solution:**

- Split processes into separate containers
- Each container wraps a single process
- If that process dies, the orchestrator restarts just that container
- You can run multiples of each container type

---

## Base Image Selection

### Never Use `latest`

```bash
# BAD - latest can change underneath you
docker pull node

# GOOD - pin to specific version
docker pull node:12.18.4
```

**Problem with latest:** Your builds work fine, then suddenly break a week later because latest changed and dependencies no longer match your package.json.

### Match Development and Production

If you're developing locally on Node 12.18.4, use `node:12.18.4` as your base image. This removes inconsistencies between dev and production.

### Start Fat, Optimize Later

**Don't worry about slim images first.** Get your application running in a "fat" image with all tools, then optimize for size later.

```dockerfile
# Start with full image to debug issues
FROM node:12.18.4

# Later, switch to slim after everything works
FROM node:12.18.4-slim
```

### Slim Images and Attack Surface

Slim images remove text editors, extra libraries, and tools you don't need in production. This reduces the attack surface—if a hacker gets in, they have fewer tools available.

---

## Layer Caching

**Each Dockerfile command creates a cached layer.**

Docker reads top-to-bottom. If a layer hasn't changed, it uses the cache. If it has changed, that layer AND all layers below are rebuilt.

### Optimal Order for Node.js

```dockerfile
FROM node:12.18.4

WORKDIR /code

# Copy package files first (change less often)
COPY package.json ./
COPY package-lock.json ./

# Install dependencies (cached if package.json unchanged)
RUN npm ci --production

# Copy source code last (changes most often)
COPY . .

CMD ["node", "server.js"]
```

**Key insight:** Put files that change most often at the BOTTOM of your Dockerfile.

**If your builds are slow:** Check if frequently-changing files are invalidating caches above expensive operations like `npm ci`.

---

## .dockerignore

**Works like .gitignore but for Docker build context.**

When you run `docker build .`, Docker bundles everything in that directory and sends it to the engine. `.dockerignore` excludes files from this context.

### Essential .dockerignore for Node.js

```
node_modules
.git
*.log
.env
README.md
LICENSE
```

**Critical: Always ignore node_modules.** Your Dockerfile runs `npm ci` to install fresh dependencies inside the container.

**Security:** Ignore `.env` files—they often contain database passwords, secrets, and API keys.

---

## Multi-Stage Builds

**Use a build image with all tools, then copy artifacts to a slim production image.**

### React + Nginx Example

```dockerfile
# Stage 1: Build
FROM node:12.18.4 AS build
WORKDIR /code
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:1.12-alpine AS prod
COPY --from=build /code/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**What happens:**

1. Build stage uses full Node image to run webpack, minify, bundle
2. Production stage uses tiny nginx image (no Node needed—React runs in browser)
3. `COPY --from=build` pulls only the built files from stage 1
4. Build stage is discarded, final image is just nginx + static files

### Targeting Specific Stages

```bash
# Build only the prod stage
docker build --target prod -t myapp:prod .

# Build only the build stage (for debugging)
docker build --target build -t myapp:build .
```

**BuildKit builds dependency graphs:** If stages A and B are independent but C depends on both, BuildKit runs A and B in parallel, then C.

---

## Graceful Shutdown

**Listen for SIGTERM and drain connections before exiting.**

**The problem:**

When Kubernetes or Swarm stops a container, it sends SIGTERM. If your app doesn't listen, it hangs for 10 seconds, then gets killed. Users mid-checkout get 500 errors.

**The solution:**

1. Listen for SIGTERM
2. Stop accepting new connections
3. Let existing requests finish (drain)
4. Shut down gracefully

### Basic Signal Handling

```javascript
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### Better: Use stoppable Package

The `stoppable` npm package tracks connections and handles draining automatically.

```javascript
const stoppable = require('stoppable');
const server = stoppable(http.createServer(app));
```

---

## Don't Use npm start

**Run node directly in your CMD, not through npm.**

### The Problem

```dockerfile
# BAD - creates two processes
CMD ["npm", "start"]
```

This creates:
1. npm as process 1
2. node as process 2 (spawned by npm)

Now you have two processes. SIGTERM goes to npm, which doesn't forward it properly to node.

### The Solution

```dockerfile
# GOOD - single process
CMD ["node", "server.js"]
```

### No Process Monitors in Production

**Don't use nodemon, pm2, or forever in production containers.**

If node dies, let the container die. Let the orchestrator (Kubernetes, Swarm) restart it. That's how you discover problems.

With a process monitor, your container looks healthy but node is crash-looping inside. You won't see it in your orchestrator's health monitoring.

---

## npm ci vs npm install

**Use `npm ci` for production builds.**

| Command | Use Case |
|---------|----------|
| `npm install` | Development - updates lock file |
| `npm ci` | CI/Production - clean slate from lock file |

```dockerfile
# Production
RUN npm ci --production

# Development
RUN npm install
```

**npm ci:**
- Deletes existing node_modules
- Installs exact versions from lock file
- Faster and more reproducible

---

## BuildKit / buildx

**Enable BuildKit for faster builds.**

### Benefits

- **Parallel builds** - Independent stages run simultaneously
- **Better caching** - Remote cache, image-based cache
- **Secrets** - Temporary secrets during build (not baked into image)
- **SSH forwarding** - Pull private repos without copying keys into image

### Enable BuildKit

```bash
# Environment variable
DOCKER_BUILDKIT=1 docker build .

# Or use buildx
docker buildx build .
```

### Multi-Architecture Builds

BuildKit can build for multiple architectures (amd64, arm64) in one command.

---

## Tini: No Longer Required

**Docker now handles SIGTERM forwarding natively.**

In older versions, Node as PID 1 couldn't receive signals properly. Tini was added as an init process to fix this.

**As of 2020:** Docker passes SIGTERM directly to your process. Tini won't hurt, but it's not necessary if your app handles signals correctly.

---

## Don't Early Optimize

**Same principle as code optimization: make it work first.**

### Progression

1. **Get it working** - Use a "fat" base image with all tools
2. **Get it correct** - Verify behavior matches development
3. **Optimize for size** - Switch to slim images, remove unnecessary dependencies
4. **Debug issues** - If something breaks, you've only changed one thing

### Team Base Images

Consider building corporate base images:
- **Build image** - All tools needed to compile/test
- **Production image** - Minimal, security-scanned, team-managed

Everyone builds on the same foundation. One team manages updates and security scanning.

---

## Summary

1. **Ephemeral and stateless** - Containers can die anytime
2. **One process per container** - Split services into separate containers
3. **Pin image versions** - Never use `latest`
4. **Order for caching** - Frequently-changed files at bottom
5. **Use .dockerignore** - Especially node_modules and .env
6. **Multi-stage builds** - Build fat, ship slim
7. **Handle SIGTERM** - Graceful shutdown with stoppable
8. **Run node directly** - No npm start, no process monitors
9. **Use npm ci** - Clean, reproducible installs
10. **Enable BuildKit** - Faster, parallel builds

---

## Resources

- **Docker Docs:** docs.docker.com/develop/develop-images/dockerfile_best-practices
- **npm ci docs:** docs.npmjs.com/cli/ci
- **BuildKit:** docs.docker.com/develop/develop-images/build_enhancements

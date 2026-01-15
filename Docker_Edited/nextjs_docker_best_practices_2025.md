# Next.js Docker Best Practices

**ByteGrad (Wesley) - November 2025**
16 minutes (extracted ~3 min of relevant content)
Source: https://www.youtube.com/watch?v=-XiPUoCIKSw

---

## Overview

Next.js-specific Docker patterns that extend the general Node.js best practices.

---

## Standalone Output Mode

**Required for Docker deployments.** Add to `next.config.js`:

```javascript
module.exports = {
  output: 'standalone'
}
```

When you run `next build`, it automatically traces only the dependencies your app needs and creates a `server.js` file that starts the server.

---

## Official Next.js Docker Template

Next.js docs provide a Docker template: https://github.com/vercel/next.js/tree/canary/examples/with-docker

Key files:
- `Dockerfile` - Multi-stage build
- `.dockerignore` - Excludes node_modules, .git, etc.

---

## Multi-Stage Dockerfile Pattern

```dockerfile
# syntax=docker.io/docker/dockerfile:1

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
USER node

ENV PORT=3000
EXPOSE 3000

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

CMD ["node", "server.js"]
```

**Key insight:** With `output: 'standalone'`, Next.js creates a `server.js` in `.next/standalone` that you run directly with `node`.

---

## Base Image Notes

**Node.js version requirement:** Next.js 16+ requires Node.js 20.9 or higher.

**Alpine vs Debian:** Both work. Alpine is smaller but has the same caveats as with regular Node.js (musl vs glibc).

---

## Image Optimization (sharp)

**Next.js 15+:** The `sharp` package is automatically installed when running in standalone output mode. No manual installation needed.

**Older versions:** Manually install sharp:
```dockerfile
RUN npm install sharp
```

---

## Multi-Architecture Builds

If deploying to a VPS with different architecture than your dev machine:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t myapp .
```

**Common issue:** Building on Apple Silicon (arm64) but deploying to x86 VPS (amd64) - the image won't run without multi-arch build.

---

## .dockerignore Essentials

```
node_modules
.next
.git
*.md
.env*
```

Prevents bloated images and accidentally including secrets.

---

## Summary

1. **Set `output: 'standalone'`** in next.config.js
2. **Use official template** as starting point
3. **Multi-stage build** - deps, build, runner stages
4. **Run as non-root** - `USER node` in final stage
5. **Copy standalone output** - `.next/standalone`, `.next/static`, `public`
6. **Run with node directly** - `CMD ["node", "server.js"]`
7. **Multi-arch if needed** - Match your deployment target

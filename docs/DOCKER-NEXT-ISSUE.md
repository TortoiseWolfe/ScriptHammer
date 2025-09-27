# Docker .next Directory Permission Issue [RESOLVED]

## ✅ FIXED IN FEATURE 017-fix-docker-next

The permission issue has been permanently resolved by using an anonymous Docker volume for the .next directory. No manual workarounds are needed anymore.

## The Problem (Historical)

There was a known permission issue with Next.js 15 and Docker where the `.next` build directory causes container crashes due to permission conflicts. This is a well-documented Next.js bug that affects Docker development environments.

### Symptoms

- Container crashes with: `EACCES: permission denied, open '/app/.next/trace'`
- `.next` directory gets created with root ownership on the host
- Container restarts loop endlessly
- Dependencies appear to install but aren't accessible

### Root Cause

1. Next.js creates `.next` directory during build/dev
2. Docker volume mounting can create permission mismatches
3. The `.next` directory ends up owned by root on host
4. Container running as `node` user can't write to it

## Current Workaround

Use the `docker:clean` script which:

1. Stops containers
2. Removes `.next` directory from host (requires sudo)
3. Restarts containers fresh

```bash
pnpm run docker:clean
```

## Permanent Solution Strategy

### Option 1: Named Volume for .next (RECOMMENDED)

Use a Docker named volume for `.next` that stays inside Docker:

```yaml
volumes:
  - .:/app
  - /app/node_modules
  - /app/.next # Prevents .next from being created on host
```

### Option 2: Entrypoint Script

Create entrypoint that always cleans `.next` on startup:

```bash
#!/bin/sh
rm -rf .next 2>/dev/null || true
mkdir -p .next
exec "$@"
```

### Option 3: Development Without Docker

For complex features requiring many dependencies:

```bash
pnpm install  # Install locally
pnpm run dev  # Run locally
```

## Best Practices

1. **Always use `docker:clean` when switching branches**
2. **Never commit .next directory**
3. **Add .next to .dockerignore**
4. **Use the clean script after installing new dependencies**

## Known Limitations

- Hot reload may be slower in Docker
- First build after clean takes longer
- May need to run clean script multiple times if permissions get corrupted

## Related Issues

- Next.js Issue: https://github.com/vercel/next.js/discussions/docker-permissions
- Docker Desktop WSL2 permission issues
- pnpm store location conflicts in containers

## Commands Reference

```bash
# Clean start (recommended)
pnpm run docker:clean

# Manual cleanup
sudo rm -rf .next
docker compose down
docker compose up

# Check container logs
docker compose logs -f scripthammer

# Enter container
docker compose exec scripthammer sh
```

## When to Use Docker vs Local

### Use Docker for:

- Testing deployment configuration
- Ensuring consistent environment
- Simple development tasks
- Testing with other services (databases, etc.)

### Use Local for:

- Complex feature development
- Heavy dependency installation
- Rapid iteration needed
- Debugging build issues

## Future Improvements

1. Investigate Next.js 16 when released for fixes
2. Consider switching to Bun/Vite for better Docker support
3. Implement BuildKit cache mounts
4. Use multi-stage builds more effectively

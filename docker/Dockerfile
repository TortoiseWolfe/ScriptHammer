# Development Dockerfile for ScriptHammer
FROM node:22-slim AS base

# Install pnpm and configure store.
# Version is pinned via package.json's "packageManager" field (single source of
# truth); corepack honors it automatically. Using pnpm@latest here caused
# 2026-05-12 build break when pnpm 11.1.1 shipped a stricter PNPM_HOME/PATH check.
RUN corepack enable && corepack prepare pnpm@10.16.1 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN pnpm config set store-dir /pnpm/store --global

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* package-lock.json* ./
# The prepare lifecycle configures hooks when Git metadata is available. Copy
# its source before installing so Docker's manifest-only dependency stage can
# execute it and safely no-op without a checkout.
COPY scripts/configure-git-hooks.js ./scripts/configure-git-hooks.js
# Use pnpm if lockfile exists, otherwise npm
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else echo "No lockfile found" && exit 1; fi

# Development image
FROM base AS dev
WORKDIR /app

# Install system dependencies for Playwright browsers and development tools (requires root)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    chromium \
    imagemagick \
    # Dependencies for Chromium, Firefox, and WebKit
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxcb1 \
    libxss1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    # Additional dependencies found missing
    libx11-xcb1 \
    libxcursor1 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libcairo-gobject2 \
    # WebKit specific
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    libenchant-2-2 \
    libsecret-1-0 \
    libhyphen0 \
    libmanette-0.2-0 \
    libwebpdemux2 \
    # Missing Playwright dependencies from validation
    libgtk-4-1 \
    libatomic1 \
    libwoff1 \
    libvpx7 \
    libevent-2.1-7 \
    libflite1 \
    libavif15 \
    libharfbuzz-icu0 \
    libwebpmux3 \
    && rm -rf /var/lib/apt/lists/* \
    && git config --global --add safe.directory /app

# Install gitleaks for secret scanning
RUN curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.24.3/gitleaks_8.24.3_linux_x64.tar.gz \
    | tar -xz -C /usr/local/bin gitleaks \
    && chmod +x /usr/local/bin/gitleaks

# Install GitHub CLI for artifact downloads
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers (requires root for system dirs).
# Install to a FIXED shared path, not a per-user $HOME cache: this RUN executes
# as root (the `USER node` switch is below), so a default install lands in
# /root/.cache/ms-playwright — unreadable/absent for the `node` user the
# container actually runs as, giving "Executable doesn't exist" at test time.
# PLAYWRIGHT_BROWSERS_PATH pins install + runtime to the same location for every
# user; chmod makes the browsers world-readable/traversable for node.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=deps /app/node_modules ./node_modules
RUN npx playwright install chromium firefox webkit \
    && chmod -R a+rX /ms-playwright

# Pre-create directories that mount as named volumes so they inherit
# node:node ownership rather than Docker's default root:root. Without
# this, `docker volume rm scripthammer_node_modules && docker compose up`
# (or any fresh-clone first start) leaves the mountpoint root-owned,
# causing EACCES when pnpm runs as node and tries to recreate .bin.
# Mirrors the ce0e64d fix that originally landed for .next.
# See: docs/interoffice/audits/2026-05-02-supabase-banner-audit.md (#69)
RUN chown -R node:node /app/node_modules \
    && mkdir -p /app/.next \
    && chown -R node:node /app/.next

# Entrypoint needs root for chmod, copy before USER switch
COPY docker/docker-entrypoint.sh docker/healthcheck.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/healthcheck.sh

# Switch to node user BEFORE copying app files (Bret Fisher pattern).
# Official node:22-slim already includes the node user — no useradd needed.
# --chown on COPY sets ownership at copy time, eliminating the expensive
# RUN chown -R that previously re-owned hundreds of thousands of files
# on every rebuild.
USER node

# Copy dependencies with correct ownership
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copy source with correct ownership
COPY --chown=node:node . .

# Expose ports for Next.js and Storybook
EXPOSE 3000 6006

# Set hostname and port
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
# Set Puppeteer to use system chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Use entrypoint to handle initialization
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start development server (Storybook can be run separately if needed)
CMD ["pnpm", "run", "dev"]

# NOTE (#275): the former `builder` + `runner` production stages were removed.
# ScriptHammer deploys as a STATIC export (output: 'export' → out/ on GitHub
# Pages), so there is no long-running Node server image: the old `runner` copied
# `.next/standalone`, which output: 'export' never emits, so it could never
# build. Production builds run as `pnpm build` in the `dev` image via the
# `builder` compose service (see docker-compose.yml), writing out/ to the mount.

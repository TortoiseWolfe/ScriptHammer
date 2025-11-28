# Development Dockerfile for ScriptHammer
FROM node:22-slim AS base

# Install pnpm and configure store
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /pnpm/store --global

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* package-lock.json* ./
# Use pnpm if lockfile exists, otherwise npm
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else echo "No lockfile found" && exit 1; fi

# Development image
FROM base AS dev
WORKDIR /app

# Create node user if it doesn't exist and set ownership
RUN useradd -m -u 1000 node 2>/dev/null || true

# Install system dependencies for Playwright browsers and development tools
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

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Install Playwright browsers
RUN npx playwright install chromium firefox webkit

COPY --chown=node:node . .

# Set proper ownership for all files
RUN chown -R node:node /app

# Copy entrypoint script
COPY --chown=node:node docker/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Don't switch to node user yet - let entrypoint handle it
# USER node

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

# Builder stage for production
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN pnpm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
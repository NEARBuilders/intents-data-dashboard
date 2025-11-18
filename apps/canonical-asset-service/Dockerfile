# Multi-stage Dockerfile for Canonical Asset Service
# Optimized for Railway deployment with minimal image size

# Base stage for shared dependencies
FROM oven/bun:1-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Development stage for build (if needed)
FROM deps AS build
COPY . .
RUN bun run build 2>/dev/null || true

# Production stage
FROM base AS prod

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY src/ ./src/
COPY package.json ./

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 canonical-service

# Switch to non-root user
USER canonical-service

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/ || exit 1

# Start the service
CMD ["bun", "run", "src/index.ts"]

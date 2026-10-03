# ==========================================
# DreamDesk CRM - Production Multi-Stage Dockerfile
# ==========================================

# Stage 1: Dependencies & Native Build Tools
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Next.js Production Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Minimal Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install runtime dependencies for SQLite
RUN apk add --no-cache libc6-compat

# Create persistent data directory
RUN mkdir -p /app/data && chown -R node:node /app/data

# Copy build artifacts and dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

USER node

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["npm", "run", "start"]

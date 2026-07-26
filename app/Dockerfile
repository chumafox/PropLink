# Build stage
FROM node:20 AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Ensure we don't copy local .env to the build if it snuck in, but it should be dockerignored
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files to install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist
# Copy other necessary runtime files if any (e.g., db schema for drizzle if needed at runtime)
# COPY --from=builder /app/db ./db 

# Run as non-root user
USER node

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]

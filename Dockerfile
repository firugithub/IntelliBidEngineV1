# Multi-stage build for IntelliBid Azure Deployment
# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build frontend only (not backend)
RUN npx vite build

# Stage 2: Build the backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code and built frontend
COPY --from=frontend-builder /app/dist ./dist
COPY . .

# Build backend using esbuild config (excludes vite from production bundle)
RUN node esbuild.config.mjs

# Stage 3: Production image
FROM node:20-alpine

WORKDIR /app

# Install su-exec for secure privilege dropping (lightweight alternative to gosu)
RUN apk add --no-cache su-exec

# Install Chromium and Puppeteer dependencies for Mermaid diagram generation
# Required for Product Technical Questionnaire context diagrams
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    fontconfig

# Set Puppeteer environment variables to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts from previous stages
COPY --from=backend-builder /app/dist ./dist

# Copy prompt files needed at runtime
COPY --from=backend-builder /app/server/prompts ./server/prompts

# Copy startup script for DNS configuration
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# NOTE: Container starts as root to allow DNS configuration in startup.sh
# The startup script drops privileges to nodejs user before running the app

# Expose port (Azure App Service uses PORT env variable)
EXPOSE 5000

# Health check (uses PORT env variable, defaults to 5000)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5000; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application via startup script (runs as root, then drops to nodejs user)
CMD ["/startup.sh"]

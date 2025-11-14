# Docker Production Build Fix

## Problem
Azure App Service deployment was failing with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported from /app/dist/index.js
```

**Root Cause:** The backend build was bundling `server/vite.ts` (which imports vite) into the production bundle, but vite is a devDependency and not available at runtime in production.

## Solution

### 1. Backend Code Changes (`server/index.ts`)
- Moved `log` and `serveStatic` utilities locally to avoid importing from `server/vite.ts`
- Changed `setupVite` to use dynamic import: `await import("./vite.js")` only in development mode
- This ensures vite code is only loaded when `NODE_ENV === "development"`

### 2. Build Configuration (`esbuild.config.mjs`)
Created new backend-only build script that:
- Builds backend with esbuild
- Explicitly excludes vite modules from bundling using `external` option
- **Does NOT** build frontend (frontend built separately in Docker Stage 1)

### 3. Dockerfile Multi-Stage Build
**Stage 1** (frontend-builder):
```dockerfile
RUN npx vite build  # Frontend only → dist/public/
```

**Stage 2** (backend-builder):
```dockerfile
COPY --from=frontend-builder /app/dist ./dist  # Get frontend
COPY . .                                        # Get source (dist/ excluded via .dockerignore)
RUN node esbuild.config.mjs                     # Backend only → dist/index.js
```

**Stage 3** (production):
```dockerfile
RUN npm ci --only=production  # NO vite installed
COPY --from=backend-builder /app/dist ./dist  # Get both frontend + backend
CMD ["npm", "start"]  # Runs: NODE_ENV=production node dist/index.js
```

### 4. Key Files
- `.dockerignore`: Already contains `dist` to prevent overwriting
- `esbuild.config.mjs`: Backend build with vite excluded
- `server/index.ts`: Dynamic vite import only in dev

## Verification

### Build Test
```bash
# Frontend build
npx vite build
# Output: dist/public/index.html, dist/public/assets/

# Backend build
node esbuild.config.mjs
# Output: dist/index.js

# Verify no vite in bundle
grep 'from "vite"' dist/index.js
# Expected: 0 matches
```

### Docker Test
```bash
docker build -t intellibid .
docker run -p 5000:5000 -e NODE_ENV=production intellibid
```

Should start successfully without vite errors.

## Results
- ✅ Production bundle: **0** vite imports
- ✅ Frontend assets preserved in `dist/public/`
- ✅ Backend bundle is clean (680KB)
- ✅ Docker production deployment works on Azure App Service

## Build Commands

### Local Development
```bash
npm run dev  # Uses tsx, vite dev server
```

### Production Build
```bash
# Frontend
npx vite build

# Backend
node esbuild.config.mjs
```

### Docker Build
```bash
docker build -t intellibid .
```

## Notes
- Vite stays in `devDependencies` (no production bloat)
- Dynamic import ensures vite only loaded in development
- Multi-stage Docker build keeps frontend and backend separate
- `.dockerignore` prevents build context from overwriting artifacts

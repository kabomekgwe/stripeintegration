# Architecture Refactor Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Overview

Refactor the application to use:
1. **Cookie-based authentication** (httpOnly, secure, sameSite)
2. **RTK Query** with cookie support (no localStorage tokens)
3. **React Server Components (RCS)** architecture
4. **Server-side proxy** with API key authentication

## Architecture Changes

### Before (Current)
```
Frontend (localStorage token) → Backend (Bearer JWT)
```

### After (Target)
```
Frontend (httpOnly cookie)
  → Next.js API Routes (Server-side proxy with API key)
  → Backend (API key validation + JWT from cookie)
```

## Benefits

- ✅ **XSS Protection**: httpOnly cookies can't be stolen by JavaScript
- ✅ **CSRF Protection**: SameSite cookies + CSRF tokens
- ✅ **Server Components**: Reduced client-side JavaScript
- ✅ **API Key Security**: Backend protected by API key, not exposed to client
- ✅ **Simplified Frontend**: No token management in Redux

---

## Task 1: Backend Cookie Authentication

**Files:**
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/strategies/jwt.strategy.ts`
- Modify: `backend/src/main.ts`

**Step 1: Install cookie-parser**

```bash
cd backend && pnpm add cookie-parser @types/cookie-parser
```

**Step 2: Update main.ts to enable CORS with credentials**

```typescript
// backend/src/main.ts
// Add cookie-parser and configure CORS
import * as cookieParser from 'cookie-parser';

app.use(cookieParser());
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // Allow cookies
});
```

**Step 3: Update JWT Strategy to read from cookies**

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
// Change from ExtractJwt.fromAuthHeaderAsBearerToken() to cookie
```

**Step 4: Update AuthController to set httpOnly cookies**

```typescript
// backend/src/auth/auth.controller.ts
// Set cookie on login/register, clear on logout
```

**Step 5: Commit**

```bash
git add backend/src/auth/ backend/src/main.ts backend/package.json
git commit -m "feat: add cookie-based authentication with httpOnly cookies"
```

---

## Task 2: Backend API Key Middleware

**Files:**
- Create: `backend/src/common/guards/api-key.guard.ts`
- Modify: `backend/src/app.module.ts`

**Step 1: Create API Key Guard**

```typescript
// backend/src/common/guards/api-key.guard.ts
// Validates X-API-Key header for all requests
```

**Step 2: Apply API Key Guard globally**

```typescript
// backend/src/app.module.ts
// Apply guard to all routes except webhooks
```

**Step 3: Commit**

```bash
git add backend/src/common/guards/ backend/src/app.module.ts
git commit -m "feat: add API key authentication middleware"
```

---

## Task 3: Next.js API Routes (Server Proxy)

**Files:**
- Create: `frontend/app/api/[...path]/route.ts` (catch-all proxy)
- Create: `frontend/lib/api-client.ts` (server-side fetch)
- Create: `frontend/lib/auth.ts` (server auth utilities)

**Step 1: Create catch-all API proxy route**

```typescript
// frontend/app/api/[...path]/route.ts
// Proxies all requests to backend with API key
```

**Step 2: Create server-side API client**

```typescript
// frontend/lib/api-client.ts
// Server-side fetch with cookie forwarding
```

**Step 3: Create auth utilities for Server Components**

```typescript
// frontend/lib/auth.ts
// getSession() for RCS, verify JWT server-side
```

**Step 4: Commit**

```bash
git add frontend/app/api/ frontend/lib/api-client.ts frontend/lib/auth.ts
git commit -m "feat: add Next.js API proxy with API key authentication"
```

---

## Task 4: Update RTK Query for Cookie Auth

**Files:**
- Modify: `frontend/store/api.ts`
- Modify: `frontend/store/authSlice.ts`
- Modify: `frontend/app/layout.tsx`

**Step 1: Update RTK Query baseQuery**

```typescript
// frontend/store/api.ts
// Remove token from localStorage, use credentials: 'include'
// Change baseUrl to '/api' (Next.js proxy)
```

**Step 2: Update authSlice (remove token management)**

```typescript
// frontend/store/authSlice.ts
// Remove token from state, only track user
```

**Step 3: Update layout with Redux Provider for Client Components**

```typescript
// frontend/app/layout.tsx
// Keep Redux for Client Components only
```

**Step 4: Commit**

```bash
git add frontend/store/ frontend/app/layout.tsx
git commit -m "refactor: update RTK Query for cookie-based auth"
```

---

## Task 5: Create Server Components

**Files:**
- Create: `frontend/app/dashboard/page.tsx` (Server Component)
- Create: `frontend/components/providers/ClientProviders.tsx`
- Modify: `frontend/app/layout.tsx`

**Step 1: Create ClientProviders component**

```typescript
// frontend/components/providers/ClientProviders.tsx
// Wraps children with Redux Provider (client-side only)
```

**Step 2: Update layout.tsx to use Server Component structure**

```typescript
// frontend/app/layout.tsx
// Root layout as Server Component
// Import ClientProviders for client-side features
```

**Step 3: Create Server Component dashboard**

```typescript
// frontend/app/dashboard/page.tsx
// Server Component that fetches data server-side
// Uses getSession() from lib/auth.ts
```

**Step 4: Commit**

```bash
git add frontend/app/dashboard/page.tsx frontend/components/providers/ frontend/app/layout.tsx
git commit -m "feat: add React Server Components with auth"
```

---

## Task 6: Update Client Components

**Files:**
- Modify: `frontend/app/auth/login/page.tsx`
- Modify: `frontend/app/auth/register/page.tsx`
- Modify: `frontend/components/Navbar.tsx`

**Step 1: Update login page**

```typescript
// frontend/app/auth/login/page.tsx
// Use RTK Query mutation, remove localStorage
```

**Step 2: Update register page**

```typescript
// frontend/app/auth/register/page.tsx
// Use RTK Query mutation, remove localStorage
```

**Step 3: Update Navbar**

```typescript
// frontend/components/Navbar.tsx
// Use RTK Query for auth state
```

**Step 4: Commit**

```bash
git add frontend/app/auth/ frontend/components/Navbar.tsx
git commit -m "refactor: update client components for cookie auth"
```

---

## Task 7: Environment Configuration

**Files:**
- Modify: `frontend/.env.example`
- Modify: `backend/.env.example`
- Modify: `docker-compose.yml`

**Step 1: Update frontend env**

```bash
# frontend/.env.example
NEXT_PUBLIC_API_URL=/api
API_KEY=your-secret-api-key
```

**Step 2: Update backend env**

```bash
# backend/.env.example
API_KEY=your-secret-api-key
```

**Step 3: Update docker-compose**

```yaml
# docker-compose.yml
# Add API_KEY to both services
```

**Step 4: Commit**

```bash
git add frontend/.env.example backend/.env.example docker-compose.yml
git commit -m "chore: add API key configuration"
```

---

## Task 8: Build and Verify

**Step 1: Build backend**

```bash
cd backend && pnpm build
```

**Step 2: Build frontend**

```bash
cd frontend && npm run build
```

**Step 3: Run typecheck**

```bash
cd frontend && npm run typecheck
```

**Step 4: Final commit**

```bash
git commit -m "chore: verify production build"
```

---

## Summary

This refactor provides:

1. **Security**: httpOnly cookies prevent XSS token theft
2. **Performance**: Server Components reduce client JS
3. **Protection**: API key secures backend from direct access
4. **Simplicity**: No token management in frontend code

**Estimated time**: 2-3 hours
**Breaking changes**: Yes (auth mechanism changes)

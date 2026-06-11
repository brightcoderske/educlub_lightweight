# Production Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the eduClub React frontend to Vercel and the Node.js backend with persistent uploads to HostAfrica cPanel under HTTPS.

**Architecture:** Vercel serves `educlub.co.ke` and `www.educlub.co.ke`. HostAfrica serves the authenticated API and uploads from `learn.educlub.co.ke`, while Supabase remains the PostgreSQL provider. Browser access is restricted by exact CORS origins; API security remains enforced by JWT authentication, role checks, school scoping, and PostgreSQL RLS.

**Tech Stack:** React/CRA, Vercel, Node.js 20, Express, cPanel Application Manager, PostgreSQL/Supabase

---

### Task 1: Validate Production Environment

**Files:**
- Create: `backend/src/config/validateProductionEnv.js`
- Create: `backend/test/validateProductionEnv.test.js`
- Modify: `backend/src/config/env.js`

- [ ] Write tests that reject weak JWT secrets, non-HTTPS public URLs, localhost origins, and wildcard CORS in production.
- [ ] Run `node --test test/validateProductionEnv.test.js` and confirm it fails because the validator does not exist.
- [ ] Implement the validator and invoke it after required environment variables are checked.
- [ ] Re-run `node --test test/validateProductionEnv.test.js` and confirm all cases pass.

### Task 2: Configure Reverse Proxy Operation

**Files:**
- Modify: `backend/src/server.js`

- [ ] Enable one trusted proxy hop in production so cPanel-proxied HTTPS requests have the correct protocol and client IP.
- [ ] Disable the identifying `X-Powered-By` response header.
- [ ] Preserve the existing exact-origin CORS, Helmet, rate limits, upload controls, and health endpoint.

### Task 3: Add Deployment Configuration and Runbook

**Files:**
- Create: `backend/.env.production.example`
- Create: `docs/PRODUCTION_DEPLOYMENT.md`

- [ ] Document the exact cPanel Node.js application values.
- [ ] Document production environment variables without including real secrets.
- [ ] Document persistent upload directory handling, Vercel environment setup, DNS, SSL, health checks, smoke tests, rollback, and backups.

### Task 4: Verify Release Candidate

**Files:**
- Verify: `backend/src/**/*.js`
- Verify: `frontend/src/**/*.js`

- [ ] Run backend configuration tests.
- [ ] Run backend syntax checks.
- [ ] Run the frontend production build with `REACT_APP_API_URL=https://learn.educlub.co.ke`.
- [ ] Inspect the final diff and confirm no secret values are tracked.

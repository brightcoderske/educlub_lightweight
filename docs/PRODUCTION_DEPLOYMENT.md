# eduClub Production Deployment

## Production Layout

- Frontend: `https://educlub.co.ke` and `https://www.educlub.co.ke` on Vercel
- Backend and uploads: `https://learn.educlub.co.ke` on HostAfrica
- API base: `https://learn.educlub.co.ke/api`
- Database: Supabase PostgreSQL

The API is necessarily reachable from learners' browsers. CORS limits which browser
origins may read responses, while JWT authentication, role checks, school scoping,
rate limits, and PostgreSQL RLS provide the actual access control.

## 1. Prepare HostAfrica

In cPanel, verify that `learn.educlub.co.ke` exists and has a valid AutoSSL or
Let's Encrypt certificate before connecting Vercel to it.

The hostname currently serves the former Moodle installation. Before changing
its application handler:

1. Open **Domains** in cPanel and record the current document root for
   `learn.educlub.co.ke`.
2. Use **File Manager** to create a compressed archive of that Moodle directory.
3. Download or move the archive outside the public document root.
4. Export the former Moodle database only if it is still needed for historical
   recovery. Do not import it into the new eduClub database.
5. Rename the old Moodle directory instead of deleting it until the new launch
   has been verified.

Open **Setup Node.js App** and create:

- Node.js version: `20.x` or the newest HostAfrica-supported LTS
- Application mode: `Production`
- Application root: the directory containing the backend `package.json`
- Application URL: `learn.educlub.co.ke`
- Application startup file: `src/server.js`

Do not force a public port when cPanel supplies `PORT` automatically.

Upload the contents of the repository's `backend` directory into the application
root. Preserve the `uploads` directory on every future deployment. In cPanel,
run **NPM Install** or execute:

```bash
npm ci --omit=dev
```

## 2. Configure Backend Variables

Add every variable from `backend/.env.production.example` through the Node.js
application's environment-variable panel. Replace every placeholder.

Generate a JWT secret locally and paste only the output into cPanel:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

Important production values:

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://learn.educlub.co.ke
FRONTEND_URL=https://educlub.co.ke
CORS_ORIGINS=https://educlub.co.ke,https://www.educlub.co.ke
DB_POOL_MAX=4
```

Use Supabase's pooled connection string when available. Never place
`DATABASE_URL`, `JWT_SECRET`, email credentials, or Flutterwave secrets in
Vercel because the React frontend would not use them and must not receive them.

Restart the Node.js application, then verify:

```text
https://learn.educlub.co.ke/health
```

It must return JSON with `"status":"ok"` over HTTPS.

## 3. Deploy the Frontend to Vercel

Set the Vercel project root directory to `frontend`.

Add this Production environment variable:

```text
REACT_APP_API_URL=https://learn.educlub.co.ke
```

This value is public by design and produces API calls under
`https://learn.educlub.co.ke/api`.

Deploy to a Vercel preview first. Test sign-in, an image, a learner course,
one progress update, one quiz submission, and one report download. Promote that
exact preview to production after it passes.

Add both domains to the Vercel project:

- `educlub.co.ke`
- `www.educlub.co.ke`

Follow the DNS values shown by Vercel. Do not delete MX, SPF, DKIM, DMARC, or
the `learn` subdomain records while replacing the old website.

## 4. Production Smoke Test

Complete these checks from a private browser window:

1. `https://educlub.co.ke` redirects and loads without certificate warnings.
2. Browser developer tools show API calls only to `https://learn.educlub.co.ke`.
3. An invalid login is rejected without revealing account details.
4. System Admin MFA and first-login password change work.
5. School Admin only sees their school.
6. A learner only sees their allocations and submissions.
7. Upload an image and school logo, refresh, and confirm both remain available.
8. Complete an activity and confirm progress and reports update.
9. Generate and download a report card.
10. Check the browser console and cPanel application log for errors.

## 5. Backups and Rollback

- Keep the previous Vercel deployment available for instant rollback.
- Back up `backend/uploads` daily; Supabase database backups do not include it.
- Keep a copy of the current cPanel environment-variable names and values in a
  password manager, never in Git or chat.
- Before backend updates, archive the application directory and uploads.
- Deploy backend changes before frontend changes that depend on a new API.

If launch verification fails, point the Vercel production alias back to the
previous deployment. Do not change the Supabase schema during rollback unless
the migration itself is known to be incompatible.

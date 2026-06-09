# EduClub LMS

EduClub is a co-curricular learning management system for schools, clubs, teachers, and learners.

This repository is intentionally scaffolded without dummy data. Real users, schools, terms, courses, questions, reports, and learner records must be created through approved application or operations workflows.

## Current Build Stage

- Role-aware dashboards for System Admin, School Admin/Teacher, and Learner.
- Native eduClub course creation and local course allocation.
- School configuration for grades and streams.
- Row-level database policies for learner-owned school data.
- Report card PDF generation with eduClub branding.
- Role-aware notifications for learner registration and course allocation.
- Versioned privacy notice and user agreement consent capture.

## Local Setup

1. Create a backend `.env` from `.env.example`.
2. Apply `database/schema.sql` to the Supabase PostgreSQL database.
3. Create the initial System Admin account deliberately with real operator-provided values:

   ```bash
   npm run seed
   ```

   Required variables: `SYSTEM_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD`.
   The generated System Admin must change the temporary setup password on first login.

4. Create real School Admin accounts only after creating a real school:

   Use the System Admin dashboard. The backend requires
   `DEFAULT_SCHOOL_ADMIN_PASSWORD` for the initial temporary password and forces
   first-login reset.

5. Install dependencies in `backend` and `frontend`.
6. Run backend on port `4000`.
7. Run frontend on port `3000`.

## Database

Run migrations from the backend folder:

```bash
cd backend
npm run migrate
```

The backend connects through `DATABASE_URL`. Row-level security is enabled on learner-facing records including learners, allocations, weekly marks, certificates, and reports. The API sets the request user, role, and school in PostgreSQL session settings so policies can scope records correctly.

Consent records are stored in `user_consents`. Each record stores the user, policy version, policy title, consent timestamp, IP address, user agent, and a JSON snapshot of the exact agreement text accepted by the user.

## Roles

- `system_admin`
- `school_admin`
- `teacher`
- `learner`

System Admin manages schools, school admins, learners, courses, terms, and global reports. School Admin manages the school, learners, allocations, reports, certificates, and school settings. Teacher is school-scoped and can configure school class streams/grades through School Settings. Learners can only access their own courses, progress, certificates, report records, and profile.

## Terms And Reports

System Admin creates academic years and terms. Other dashboards pull these terms through the Academic API. The active term is resolved by today's date first: if today's date falls between a term start and end date, that term is treated as current. If none matches, the manually active term is used as a fallback.

Report cards can be generated from learner records and from the School Admin learner modal. Report PDFs wait for file generation to finish before download begins.

## Passwords And Notifications

First-login password reset and dashboard password changes enforce visible password rules: at least 8 characters, uppercase, lowercase, number, symbol, no spaces, and matching confirmation.

Users with reachable email addresses can use the public forgot-password flow. The system sends a 30-minute, one-time reset link and never emails the new password.

System Admin and School Admin can trigger password resets for users they manage. If the account has a reachable email address, eduClub emails a one-time reset link. If a learner still uses a local `@learners.educlub.local` address, the operator can generate a one-time random temporary password that must be changed at next sign-in. Shared default passwords should not be used for reset flows.

MFA remains for admin roles.

Notifications appear from the dashboard bell. Learners see course-allocation notices. School staff see allocation notices for their school. System Admin sees learner registration notices.

## Competition Payments

Paid competitions use Flutterwave payment links. The backend creates a unique `tx_ref`, verifies the transaction server-side with Flutterwave, and then marks the competition enrolment as `enrolled`.

Set `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_ENCRYPTION_KEY`, and `FLUTTERWAVE_WEBHOOK_SECRET_HASH` in `backend/.env`. In the Flutterwave dashboard, configure the webhook URL as:

```text
https://your-backend-domain/api/competitions/payments/webhook
```

For local testing, expose `http://localhost:4000` with a trusted tunnel and use the tunneled URL. The dashboard webhook secret hash must exactly match `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.

## Privacy And Consent

eduClub displays a short privacy banner on the sign-in screen and requires authenticated users to accept the full privacy notice and user agreement before reaching dashboards. First-login password reset is handled first, then consent is required before normal access.

The current policy text lives in `backend/src/config/privacyPolicy.js` and is versioned. Updating the `version` value causes users to be asked to accept the new policy while preserving previous acceptance records.

The agreement explains that eduClub collects account identifiers, school and learner profile records, course allocations, progress, weekly marks, reports, certificates, security/audit data, notifications, and approved uploaded/generated files. The stated uses are learning delivery, school administration, reporting, certificates, account protection, auditability, platform reliability, and legal or safeguarding responsibilities.

## Security Baseline

- Passwords are bcrypt-hashed and first-login password reset is enforced.
- MFA is required for System Admin and School Admin roles.
- JWT access tokens are required for protected API routes.
- Supabase row-level security is enabled across application tables, with policies scoped by the API request user, role, and school.
- Database indexes cover dashboard filters, learner records, course allocations, competitions, payments, feedback, notifications, and reporting lookups.
- Login and MFA verification have stricter rate limits than general API traffic.
- Temporary token/debug files and local secrets must not be committed. Rotate JWT, email, payment, and any optional integration secrets if they are exposed.

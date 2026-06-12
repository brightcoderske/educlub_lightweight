# HostAfrica Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send eduClub transactional email through the HostAfrica mailbox with a consistent sender and support reply address.

**Architecture:** Extend environment configuration with `EMAIL_REPLY_TO`, centralize common message headers in the email utility, and add a non-sending SMTP verification command. Production validation will reject malformed email settings without logging credentials.

**Tech Stack:** Node.js, Nodemailer, Node test runner, HostAfrica SMTP

---

### Task 1: Validate production email configuration

**Files:**
- Modify: `backend/src/config/validateProductionEnv.js`
- Modify: `backend/test/validateProductionEnv.test.js`

- [ ] Add failing tests for malformed sender, reply-to, SMTP port, and insecure production SMTP.
- [ ] Run the focused test and confirm the new assertions fail.
- [ ] Add minimal validation for `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_PORT`, and `EMAIL_SECURE`.
- [ ] Run the focused test and confirm all assertions pass.

### Task 2: Apply common transactional email headers

**Files:**
- Modify: `backend/src/config/env.js`
- Modify: `backend/src/utils/email.js`
- Create: `backend/test/emailConfig.test.js`

- [ ] Add a failing test asserting every mail type uses the configured From and Reply-To headers.
- [ ] Export a small mail-default builder and use it in every outgoing message.
- [ ] Confirm the focused email test passes.

### Task 3: Add a non-sending SMTP check

**Files:**
- Create: `backend/scripts/verify-email.js`
- Modify: `backend/package.json`
- Modify: `backend/test/packageScripts.test.js`
- Modify: `backend/.env.production.example`
- Modify: `docs/PRODUCTION_DEPLOYMENT.md`

- [ ] Add a failing package-script test for `email:verify`.
- [ ] Add a Nodemailer `verify()` script that prints only success or a sanitized failure.
- [ ] Document HostAfrica SMTP variables using placeholders only.
- [ ] Run the complete backend test suite and inspect the diff for secrets.

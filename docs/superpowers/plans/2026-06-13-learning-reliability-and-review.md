# Learning Reliability and Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver reliable active sessions, direct learner navigation, complete teacher review, lightweight rich hints, learner preview, and active-term self-registration.

**Architecture:** Extend the existing JWT, course progress, submission, quiz-attempt, term, and allocation flows. Use activity-driven token renewal and local React state updates; do not add polling, queues, duplicate progress tables, or new editor dependencies.

**Tech Stack:** React 18, React Router, Material UI, Express, PostgreSQL, `jsonwebtoken`, Node test runner, Jest.

---

### Task 1: Session Reliability

**Files:**
- Modify: `backend/src/services/auth.service.js`
- Modify: `backend/src/controllers/auth.controller.js`
- Modify: `backend/src/routes/auth.routes.js`
- Create: `backend/test/authRefresh.test.js`
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/context/AuthContext.js`
- Modify: `frontend/src/components/IdleTimeoutGuard.js`
- Create: `frontend/src/lib/session.js`
- Create: `frontend/src/__tests__/session.test.js`

- [ ] Write failing tests proving active users refresh only near expiry and 401/expired-token 403 responses emit one expiry event.
- [ ] Add authenticated `POST /api/auth/refresh` that reloads the active user and returns the existing auth response shape.
- [ ] Add a lightweight JWT expiry helper and one in-flight refresh guard in the API client.
- [ ] Make the auth context clear credentials, preserve the requested path, and redirect immediately on expiry.
- [ ] Keep the inactivity guard, but reset it on learner activity and avoid duplicate logout calls.
- [ ] Run focused backend/frontend tests and commit.

### Task 2: Learner Resume and Navigation

**Files:**
- Modify: `backend/src/services/courses.service.js`
- Modify: `frontend/src/layouts/learner/index.js`
- Modify: `frontend/src/layouts/learner/course-overview/index.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Create: `frontend/src/layouts/learner/learningNavigation.js`
- Create: `frontend/src/__tests__/learningNavigation.test.js`

- [ ] Write failing tests for resume destination priority, previous/next selection, and locked activity behavior.
- [ ] Include progress timestamps and resume metadata in existing learning overview responses.
- [ ] Add one Continue Learning dashboard action derived from current course data.
- [ ] Make overview activity cards fully clickable with visible locked reasons.
- [ ] Support `?activity=<id>`, Previous Activity, Next Activity, compact top navigation, and scroll-to-top.
- [ ] Replace redundant reloads with local progress state updates.
- [ ] Run focused tests and commit.

### Task 3: Review, Marks, and Typed Answers

**Files:**
- Modify: `backend/src/services/courses.service.js`
- Modify: `backend/src/services/quizTests.service.js`
- Modify: `backend/src/controllers/weeklyLearning.controller.js`
- Modify: `backend/src/routes/weeklyLearning.routes.js`
- Modify: `frontend/src/layouts/course-builder/index.js`
- Modify: `frontend/src/layouts/weekly-learning/index.js`
- Create: `backend/test/reviewAndAnswers.test.js`
- Create: `frontend/src/__tests__/gradingReview.test.js`

- [ ] Write failing tests for maximum-grade enforcement and normalized acceptable short answers.
- [ ] Reject course activity grades above `activity.points`.
- [ ] Render all existing submission content, quiz answers, and maximum marks in teacher review.
- [ ] Add school-scoped weekly quiz attempt review using existing attempt answer JSON.
- [ ] Replace comma-only short answers with repeatable acceptable-answer fields while retaining old string compatibility.
- [ ] Run focused tests and commit.

### Task 4: Rich Hints and Learner Preview

**Files:**
- Modify: `frontend/src/layouts/course-builder/index.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Modify: `frontend/src/layouts/learner/course-overview/index.js`
- Modify: `frontend/src/routes.js`
- Create: `frontend/src/layouts/course-builder/dialogs/HintDialog.js`
- Create: `frontend/src/layouts/learner/HintBlock.js`
- Create: `frontend/src/__tests__/hintAndPreview.test.js`

- [ ] Write failing tests for safe hint markup and read-only preview policy.
- [ ] Add a cursor-position hint block command to the existing rich editor.
- [ ] Render hint blocks as learner-controlled reveal sections.
- [ ] Add Preview as Learner routes for assigned teachers and school administrators.
- [ ] Reuse learner views with a preview flag that blocks every progress, answer, discussion, upload, grade, and badge mutation.
- [ ] Run focused tests and commit.

### Task 5: Self-Registration and Active Terms

**Files:**
- Modify: `backend/src/services/publicRegistration.service.js`
- Modify: `backend/src/controllers/public.controller.js`
- Modify: `backend/src/routes/public.routes.js`
- Modify: `frontend/src/layouts/landing/index.js`
- Create: `backend/test/publicRegistration.test.js`
- Create: `frontend/src/__tests__/registration.test.js`

- [ ] Write failing tests for active-term fallback, selected-term validation, year-labelled options, and form readiness.
- [ ] Expose public registration terms without exposing private academic data.
- [ ] Validate or assign the active term inside the registration transaction.
- [ ] Persist the learner term using the existing learner academic fields/relationships.
- [ ] Enable Register only after required fields and consent are complete and redirect clearly after success.
- [ ] Run focused tests and commit.

### Task 6: Verification and Delivery

**Files:**
- Modify only if verification exposes a defect.

- [ ] Run all backend tests.
- [ ] Run all frontend tests.
- [ ] Run Prettier and the frontend production build.
- [ ] Run schema/migration compatibility checks without destructive SQL.
- [ ] Browser-test session expiry, Continue Learning, activity navigation, grading, preview, and registration at desktop and mobile sizes.
- [ ] Merge the feature branch into `main`, push GitHub, and verify the deployed frontend/backend health.

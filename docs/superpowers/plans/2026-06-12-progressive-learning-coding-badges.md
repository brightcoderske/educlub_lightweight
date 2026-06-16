# Progressive Learning, Coding, Badges, and Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backward-compatible progressive learning, school scheduling, optional practice, true/false quizzes, safe executable coding, durable module badges, and anonymous module feedback.

**Architecture:** Additive PostgreSQL tables and columns preserve every existing identifier and progress row. Focused backend services resolve availability, award badges, evaluate safe coding checks, and protect anonymous feedback; existing course controllers expose those services. React builders and learner views consume structured metadata while retaining legacy defaults.

**Tech Stack:** PostgreSQL with RLS, Node.js 20, Express, `pg`, React 18, Material UI 5, Jest, Node test runner.

---

## File Structure

- `backend/src/database/schema.sql`: additive columns, tables, constraints, indexes, and RLS.
- `backend/src/services/activityAvailability.service.js`: pure progression and scheduling decisions.
- `backend/src/services/moduleBadges.service.js`: score tiers and idempotent learner/module award updates.
- `backend/src/services/codingChallenges.service.js`: coding configuration validation and safe source checks.
- `backend/src/services/moduleFeedback.service.js`: feedback writes, anonymous reporting, and moderation audits.
- `backend/src/services/courses.service.js`: integrate focused services with existing course operations.
- `backend/src/controllers/courses.controller.js`: HTTP handlers for overrides, badges, and feedback.
- `backend/src/routes/courses.routes.js`: authenticated course endpoints.
- `backend/test/*.test.js`: backend behavior tests.
- `frontend/src/layouts/course-builder/activityForm.js`: structured activity metadata defaults and serialization.
- `frontend/src/layouts/course-builder/index.js`: scheduling, Try More, true/false, coding challenge, and executable block authoring.
- `frontend/src/layouts/learner/module-learn/activityContent.js`: normalize coding and executable lesson metadata.
- `frontend/src/layouts/learner/module-learn/index.js`: locking, optional cards, execution, badges, and feedback.
- `frontend/src/layouts/learner/index.js`: recent and lifetime badge summary.
- `frontend/src/layouts/weekly-learning/index.js`: true/false authoring and answering.
- `frontend/src/__tests__/*.test.js`: frontend normalization and rule tests.

### Task 1: Add Backward-Compatible Database Structures

**Files:**
- Modify: `backend/src/database/schema.sql`
- Create: `backend/test/progressiveSchema.test.js`

- [ ] **Step 1: Write a failing schema contract test**

Assert that the schema contains `availability_mode`, school schedules, availability overrides, learner module badges, module feedback, feedback identity audits, true/false weekly questions, unique learner/module constraints, and RLS enablement.

- [ ] **Step 2: Run the schema test and verify it fails**

Run: `node --test backend/test/progressiveSchema.test.js`

Expected: FAIL because the additive structures are absent.

- [ ] **Step 3: Add idempotent schema changes**

Add:

```sql
ALTER TABLE learning_activities
  ADD COLUMN IF NOT EXISTS availability_mode VARCHAR(20) NOT NULL DEFAULT 'required'
  CHECK (availability_mode IN ('required', 'try_more'));

CREATE TABLE IF NOT EXISTS school_module_schedules (...);
CREATE TABLE IF NOT EXISTS learning_availability_overrides (...);
CREATE TABLE IF NOT EXISTS learner_module_badges (...);
CREATE TABLE IF NOT EXISTS module_feedback (...);
CREATE TABLE IF NOT EXISTS feedback_identity_audits (...);
```

Use foreign keys to existing school courses, modules, users, academic terms, and classes where applicable. Add unique and lookup indexes, extend the weekly question constraint with `true_false`, enable RLS, and add role/school-scoped policies following existing `app.current_*` policy conventions.

- [ ] **Step 4: Run the schema contract and backend tests**

Run: `npm test --prefix backend`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/schema.sql backend/test/progressiveSchema.test.js
git commit -m "feat: add progressive learning schema"
```

### Task 2: Implement Availability and Progression

**Files:**
- Create: `backend/src/services/activityAvailability.service.js`
- Create: `backend/test/activityAvailability.test.js`
- Modify: `backend/src/services/courses.service.js`
- Modify: `backend/src/controllers/courses.controller.js`
- Modify: `backend/src/routes/courses.routes.js`

- [ ] **Step 1: Write failing pure-rule tests**

Cover:

```js
assert.equal(resolveModuleAvailability({ schedule: null }).isOpen, true);
assert.equal(resolveModuleAvailability({ openAt: future, override: null }).isOpen, false);
assert.equal(resolveModuleAvailability({ openAt: future, override: validOverride }).isOpen, true);
assert.equal(canOpenActivity({ mode: "try_more", moduleOpen: true }).allowed, true);
assert.equal(canOpenActivity({ previousRequiredComplete: false }).allowed, false);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test backend/test/activityAvailability.test.js`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement pure availability functions**

Export `resolveModuleAvailability`, `canOpenActivity`, and `getPrerequisiteActivityId`. Required activities use required-position order; Try More activities never become prerequisites. An absent schedule preserves current availability.

- [ ] **Step 4: Integrate with course learning queries**

Return `is_unlocked`, `lock_reason`, `prerequisite_activity_id`, `availability_mode`, and `schedule` in overview/module payloads. Reject progress and submission writes for locked activities. Add school-scoped override create/list/delete endpoints and audit fields.

- [ ] **Step 5: Run backend tests**

Run: `npm test --prefix backend`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/activityAvailability.service.js backend/test/activityAvailability.test.js backend/src/services/courses.service.js backend/src/controllers/courses.controller.js backend/src/routes/courses.routes.js
git commit -m "feat: enforce progressive activity access"
```

### Task 3: Add True/False and Safe Coding Challenges

**Files:**
- Create: `backend/src/services/codingChallenges.service.js`
- Create: `backend/test/codingChallenges.test.js`
- Modify: `backend/src/services/courses.service.js`
- Modify: `backend/src/services/quizTests.service.js`
- Modify: `frontend/src/layouts/course-builder/activityForm.js`
- Modify: `frontend/src/layouts/course-builder/index.js`
- Modify: `frontend/src/layouts/weekly-learning/index.js`
- Modify: `frontend/src/layouts/learner/module-learn/activityContent.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Modify: `frontend/src/__tests__/activityForm.test.js`
- Modify: `frontend/src/__tests__/activityContent.test.js`

- [ ] **Step 1: Write failing normalization and validation tests**

Test boolean answer normalization, challenge modes `build|complete|debug`, total check marks not exceeding activity marks, HTML selector/text checks, and rejection of executable server-side expressions.

- [ ] **Step 2: Run focused backend and frontend tests**

Run:

```bash
node --test backend/test/codingChallenges.test.js
npm test --prefix frontend -- --runInBand activityForm activityContent
```

Expected: FAIL for missing coding helpers and true/false normalization.

- [ ] **Step 3: Implement safe coding configuration and checks**

Store starter HTML/CSS/JS, challenge mode, public/private checks, and instructions in activity content. Perform authoritative checks through source parsing and restricted HTML/CSS inspection only. Never evaluate submitted JavaScript in Node.

- [ ] **Step 4: Add builder controls**

Add true/false to course and weekly quiz type menus. Add coding mode, starter panes, check editor, and executable lesson-block insertion. Ensure check marks cannot exceed activity marks.

- [ ] **Step 5: Add learner execution**

Run HTML/CSS/JS in an iframe with `sandbox="allow-scripts"`, keep output hidden until Run, support reset, and preserve the existing submission route. Render true/false as two clear choices.

- [ ] **Step 6: Run tests and production build**

Run:

```bash
npm test --prefix backend
npm test --prefix frontend -- --runInBand
npm run build --prefix frontend
```

Expected: PASS and a successful production build.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/codingChallenges.service.js backend/test/codingChallenges.test.js backend/src/services/courses.service.js backend/src/services/quizTests.service.js frontend/src/layouts/course-builder frontend/src/layouts/weekly-learning/index.js frontend/src/layouts/learner/module-learn frontend/src/__tests__
git commit -m "feat: add true false and coding challenges"
```

### Task 4: Materialize and Recalculate Module Badges

**Files:**
- Create: `backend/src/services/moduleBadges.service.js`
- Create: `backend/test/moduleBadges.test.js`
- Modify: `backend/src/services/courses.service.js`
- Modify: `backend/src/services/courseProgress.service.js`
- Modify: `backend/src/controllers/courses.controller.js`
- Modify: `backend/src/routes/courses.routes.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Modify: `frontend/src/layouts/learner/index.js`

- [ ] **Step 1: Write failing tier and upsert tests**

Verify `70.99 => completion`, `71 => bronze`, `80 => bronze`, `80.01 => silver`, `90 => silver`, `90.01 => gold`, and that regrading updates one learner/module award.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test backend/test/moduleBadges.test.js`

Expected: FAIL because the badge service does not exist.

- [ ] **Step 3: Implement badge service**

Export `getBadgeTier`, `calculateModuleScore`, `upsertModuleBadge`, and `listLearnerBadges`. Use `ON CONFLICT (learner_id, module_id) DO UPDATE` and retain thematic module badge names.

- [ ] **Step 4: Add recalculation triggers**

Call the service after progress completion, quiz submission, coding auto-marking, and teacher grade changes. Badge errors are logged without discarding the successful primary transaction.

- [ ] **Step 5: Add learner displays**

Show the awarded tier and color in module congratulations, recent badges and lifetime counts on the dashboard, and grouped historical badges in the existing certificates/badges experience.

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm test --prefix backend
npm test --prefix frontend -- --runInBand
npm run build --prefix frontend
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/moduleBadges.service.js backend/test/moduleBadges.test.js backend/src/services/courses.service.js backend/src/services/courseProgress.service.js backend/src/controllers/courses.controller.js backend/src/routes/courses.routes.js frontend/src/layouts/learner
git commit -m "feat: award recalculating module badges"
```

### Task 5: Add Anonymous Module Feedback and Auditing

**Files:**
- Create: `backend/src/services/moduleFeedback.service.js`
- Create: `backend/test/moduleFeedback.test.js`
- Modify: `backend/src/controllers/courses.controller.js`
- Modify: `backend/src/routes/courses.routes.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Modify: `frontend/src/layouts/school-admin/reports/index.js`
- Modify: `frontend/src/layouts/system-admin/index.js`

- [ ] **Step 1: Write failing permission and aggregation tests**

Test rating bounds, completion requirement, one updatable learner/module response, school filtering, anonymous comments, cross-school aggregates, and reason-required system-admin identity reveal.

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test backend/test/moduleFeedback.test.js`

Expected: FAIL because the feedback service does not exist.

- [ ] **Step 3: Implement feedback service and routes**

Add learner upsert/read endpoints, school/system aggregate endpoints, and a system-admin moderation endpoint that inserts an identity-access audit before returning identity.

- [ ] **Step 4: Add learner rating UI**

Show 1-to-5 stars and optional comment after module completion. Save and update without blocking the completion celebration.

- [ ] **Step 5: Add admin reporting**

Add compact module feedback summaries, distribution, trend, and paginated anonymous comments. Keep school data scoped and identity hidden.

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm test --prefix backend
npm test --prefix frontend -- --runInBand
npm run build --prefix frontend
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/moduleFeedback.service.js backend/test/moduleFeedback.test.js backend/src/controllers/courses.controller.js backend/src/routes/courses.routes.js frontend/src/layouts/learner/module-learn/index.js frontend/src/layouts/school-admin/reports/index.js frontend/src/layouts/system-admin/index.js
git commit -m "feat: add anonymous module feedback"
```

### Task 6: Add School Scheduling and Override UI

**Files:**
- Modify: `frontend/src/layouts/course-builder/index.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Modify: `frontend/src/__tests__/activityForm.test.js`

- [ ] **Step 1: Write failing UI normalization tests**

Verify existing modules serialize with no schedule, existing activities default to required, and Try More remains optional.

- [ ] **Step 2: Add compact scheduling controls**

For school courses only, select active term and calculated opening week. Add module/activity early-unlock dialogs supporting class, selected learners, or one learner with a required reason.

- [ ] **Step 3: Refine learner cards**

Show clear lock reasons, opening week/date, prerequisite activity, and colorful Try More cards without changing required-card behavior.

- [ ] **Step 4: Run tests, lint through build, and responsive verification**

Run:

```bash
npm test --prefix frontend -- --runInBand
npm run build --prefix frontend
```

Use the in-app browser at desktop, tablet, and mobile widths to verify no overlap, readable cards, progression locks, code output, badge celebration, and feedback controls.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/course-builder/index.js frontend/src/layouts/learner/module-learn/index.js frontend/src/__tests__/activityForm.test.js
git commit -m "feat: add school course scheduling controls"
```

### Task 7: Migration and Full Regression Verification

**Files:**
- Modify only if verification finds defects in files already included above.

- [ ] **Step 1: Run schema migration against the configured development database**

Run: `npm run migrate --prefix backend`

Expected: migration completes without dropping or recreating existing course/progress tables.

- [ ] **Step 2: Compare protected row counts**

Record counts for courses, modules, activities, allocations, activity progress, submissions, quiz attempts, and grades before and after. Expected: unchanged by the additive migration.

- [ ] **Step 3: Run all automated checks**

Run:

```bash
npm test --prefix backend
npm test --prefix frontend -- --runInBand
npm run build --prefix frontend
```

Expected: PASS.

- [ ] **Step 4: Verify end-to-end learner and teacher flows**

Verify existing course access, progressive completion, Try More, scheduled module opening, early override, true/false quiz points, coding run/submission, badge upgrade after regrade, feedback anonymity, and mobile layouts.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intentional feature changes plus pre-existing unrelated workspace changes.


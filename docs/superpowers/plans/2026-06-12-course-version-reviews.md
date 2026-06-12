# Course Version Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add course-level review reports reachable from system-admin and school course lists, with cross-school drill-down for system administrators and school-scoped anonymous reports for teachers.

**Architecture:** Extend `moduleFeedback.service.js` with two report queries: a template aggregate listing adopted school versions and a school-course detail report. Expose them through the existing courses controller/router, then render them with one shared responsive React report component whose behavior is determined by the authenticated role and route.

**Tech Stack:** Node.js, Express, PostgreSQL, React 18, React Router, Material UI, Node test runner, Jest.

---

## File Structure

- Modify `backend/src/services/moduleFeedback.service.js`: validation, authorization, aggregate queries, pagination, and anonymous report shaping.
- Modify `backend/src/services/courses.service.js`: staff-facing service wrappers.
- Modify `backend/src/controllers/courses.controller.js`: HTTP handlers and query parsing.
- Modify `backend/src/routes/courses.routes.js`: report routes before the generic `/:id` route.
- Modify `backend/test/moduleFeedback.test.js`: report input, privacy, and role-scope tests.
- Modify `frontend/src/layouts/system-admin/AdminResourcePage.js`: support optional row actions without duplicating the generic course table.
- Modify `frontend/src/layouts/system-admin/courses/index.js`: add the template Reviews action.
- Modify `frontend/src/layouts/school-admin/courses/index.js`: add the school-course Reviews action.
- Create `frontend/src/layouts/course-reviews/index.js`: shared template and school-version report page.
- Create `frontend/src/layouts/course-reviews/reportUtils.js`: rating presentation and query helpers.
- Create `frontend/src/__tests__/courseReviews.test.js`: report utility and role behavior tests.
- Modify `frontend/src/routes.js`: hidden report routes for both role groups.

### Task 1: Report Contract And Validation

**Files:**
- Modify: `backend/test/moduleFeedback.test.js`
- Modify: `backend/src/services/moduleFeedback.service.js`

- [ ] **Step 1: Write failing tests for pagination, rating filters, and role scope**

Add tests asserting that report filters normalize `page`, `pageSize`, `rating`,
`search`, `moduleId`, `from`, and `to`, reject invalid ratings, and force
non-system staff to their authenticated `schoolId`.

- [ ] **Step 2: Run the focused backend test**

Run: `npm test -- --test-name-pattern="module feedback"`, from `backend`.

Expected: FAIL because the report filter helpers do not exist.

- [ ] **Step 3: Implement pure report helpers**

Export:

```js
normalizeReportFilters(filters = {})
resolveReportSchoolScope(user = {}, requestedSchoolId)
```

Use bounded pagination (`page >= 1`, `pageSize <= 50`), integer IDs, optional
ISO date strings, and a rating from one to five.

- [ ] **Step 4: Re-run the focused test**

Run: `npm test -- --test-name-pattern="module feedback"`, from `backend`.

Expected: PASS.

### Task 2: Template And School-Version Report Queries

**Files:**
- Modify: `backend/src/services/moduleFeedback.service.js`
- Modify: `backend/src/services/courses.service.js`
- Modify: `backend/src/controllers/courses.controller.js`
- Modify: `backend/src/routes/courses.routes.js`
- Modify: `backend/test/moduleFeedback.test.js`

- [ ] **Step 1: Add failing contract tests**

Test that anonymous rows remove learner fields, template reports require
`system_admin`, school reports allow staff, and school staff cannot request a
different school.

- [ ] **Step 2: Run the backend suite and confirm failure**

Run: `npm test`, from `backend`.

Expected: FAIL on missing report functions.

- [ ] **Step 3: Implement the template report**

Add:

```js
getTemplateFeedbackReport(templateId, user, filters)
```

The query must confirm the template exists, aggregate all `courses.template_id`
matches, calculate the overall average/distribution, and return paginated school
versions containing school name, course ID/version, response count, course
average, and lowest module average. Apply search to school and course names.

- [ ] **Step 4: Implement the school-course report**

Add:

```js
getCourseFeedbackReport(courseId, user, filters)
```

Confirm course access first. Return course metadata, overall
average/distribution, module summaries, and paginated anonymous comments.
Apply module, rating, and date filters. Do not select learner identity fields.

- [ ] **Step 5: Expose the endpoints**

Add:

```text
GET /courses/templates/:templateId/feedback-report
GET /courses/:courseId/feedback-report
```

The template route requires `system_admin`. The course route permits
`system_admin`, `school_admin`, and `teacher`, with service-level school scope.

- [ ] **Step 6: Run backend tests**

Run: `npm test`, from `backend`.

Expected: all tests pass.

### Task 3: Shared Report Presentation

**Files:**
- Create: `frontend/src/layouts/course-reviews/reportUtils.js`
- Create: `frontend/src/__tests__/courseReviews.test.js`
- Create: `frontend/src/layouts/course-reviews/index.js`

- [ ] **Step 1: Write failing frontend utility tests**

Cover rating status colors, display labels, query-string construction, and
whether identity reveal is available only to `system_admin`.

- [ ] **Step 2: Run focused frontend tests**

Run: `npm test -- --runInBand courseReviews.test.js`, from `frontend`.

Expected: FAIL because `reportUtils.js` does not exist.

- [ ] **Step 3: Implement report utilities**

Export deterministic helpers for rating labels/colors, distribution rows,
query parameters, and role capabilities.

- [ ] **Step 4: Build the shared page**

Use route parameters to select template or course mode. Render summary metrics,
rating distribution, searchable school-version rows for system administrators,
module summaries, anonymous comments, filters, pagination, empty/error states,
and an identity-reveal dialog requiring a reason.

Keep requests event-driven: initial load, filter submit, pagination, and school
version selection only. Do not poll.

- [ ] **Step 5: Re-run focused frontend tests**

Run: `npm test -- --runInBand courseReviews.test.js`, from `frontend`.

Expected: PASS.

### Task 4: Course-List Entry Points And Routes

**Files:**
- Modify: `frontend/src/layouts/system-admin/AdminResourcePage.js`
- Modify: `frontend/src/layouts/system-admin/courses/index.js`
- Modify: `frontend/src/layouts/school-admin/courses/index.js`
- Modify: `frontend/src/routes.js`

- [ ] **Step 1: Add generic row-action support**

Add an optional `actions` prop to `AdminResourcePage`. Render a final Actions
column and buttons that call `navigate(action.path(item))`.

- [ ] **Step 2: Add the system-admin Reviews action**

Route templates to:

```text
/system-admin/courses/:templateId/reviews
```

- [ ] **Step 3: Add the school Reviews action**

Route adopted school courses to:

```text
/school-admin/courses/:courseId/reviews
```

- [ ] **Step 4: Register hidden routes**

Register both paths with the shared `CourseReviews` component and preserve the
existing role guards.

- [ ] **Step 5: Run frontend tests and formatting checks**

Run:

```text
npm test -- --runInBand
npx prettier --check "src/**/*.{js,jsx}"
```

Expected: all tests and formatting checks pass.

### Task 5: Full Verification And Integration

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run the backend suite**

Run: `npm test`, from `backend`.

Expected: all tests pass.

- [ ] **Step 2: Run the frontend suite and production build**

Run:

```text
npm test -- --runInBand
npm run build
```

Expected: tests pass and the production build completes without ESLint errors.

- [ ] **Step 3: Browser-check desktop and mobile**

Verify the system-admin course list action, template school-version report,
school drill-down, teacher-scoped report, filters, empty state, audited reveal
dialog, and no horizontal overflow at a mobile viewport.

- [ ] **Step 4: Review the final diff**

Run:

```text
git diff --check
git status --short
```

Confirm no unrelated existing files are staged or modified by this feature.

- [ ] **Step 5: Commit and integrate**

Commit the feature, merge it into local `main`, push `main`, and use the
configured Vercel and HostAfrica deployment workflows. Run the live health
check before testing login and reports.

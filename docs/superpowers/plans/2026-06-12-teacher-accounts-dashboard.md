# Teacher Accounts and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add school-scoped teacher accounts, assigned-course permissions, a teacher dashboard, school branding, learner due-work cards, and named report-card feedback without disturbing existing course or learner data.

**Architecture:** An additive assignment table and a focused `teacherAssignments` service become the authorization source for teacher course and learner access. Existing course, allocation, learner, and report services call those helpers, while role-specific frontend routes reuse existing operational screens. Authentication carries school identity once per login, and learner due work is calculated on dashboard request from existing schedules and progress.

**Tech Stack:** PostgreSQL with RLS, Node.js/Express, React 18, Material UI, Jest, Node test runner.

---

## File Structure

**Backend**

- `backend/src/database/schema.sql`: additive teacher assignment/update-request tables, indexes, and RLS.
- `backend/src/services/teacherAssignments.service.js`: assignment CRUD and teacher scope checks.
- `backend/src/controllers/teacherAssignments.controller.js`: HTTP validation and responses.
- `backend/src/routes/teacherAssignments.routes.js`: staff assignment and update-request endpoints.
- `backend/src/server.js`: route registration.
- `backend/src/controllers/users.controller.js`: role-aware school staff creation and school-scoped teacher management.
- `backend/src/routes/users.routes.js`: system-admin and school-admin staff routes.
- `backend/src/services/auth.service.js`: school name/logo in login and current-user data.
- `backend/src/services/courses.service.js`: assigned-course checks and teacher update request.
- `backend/src/services/courseTemplates.service.js`: notify assigned teachers without granting sync rights.
- `backend/src/controllers/learners.controller.js`: assigned-learner listing and promotion scope.
- `backend/src/controllers/allocations.controller.js`: teachers allocate only assigned courses.
- `backend/src/services/reports.service.js`: assigned-learner feedback access and author metadata.
- `backend/src/services/learnerDueWork.service.js`: current-week and overdue learner work aggregation.
- `backend/src/controllers/learnerDashboard.controller.js`: due-work response.
- `backend/src/routes/learnerDashboard.routes.js`: learner dashboard endpoint.
- `backend/src/services/teacherDashboard.service.js`: one assigned-work summary query surface.
- `backend/src/controllers/teacherDashboard.controller.js`: teacher dashboard response.
- `backend/src/routes/teacherDashboard.routes.js`: assigned teacher dashboard endpoint.

**Frontend**

- `frontend/src/layouts/system-admin/school-admins/index.js`: staff role selector and teacher listing.
- `frontend/src/layouts/school-admin/teachers/index.js`: school teacher creation and course assignment.
- `frontend/src/layouts/teacher/index.js`: dedicated teacher dashboard.
- `frontend/src/routes.js`: role-specific teacher and school-admin routes.
- `frontend/src/App.js`: role dashboard destination and school-branded sidenav.
- `frontend/src/context/AuthContext.js`: teacher helpers and persisted school identity.
- `frontend/src/lib/userDisplay.js`: teacher label and school identity helpers.
- `frontend/src/examples/Sidenav/index.js`: school/platform identity treatment.
- `frontend/src/examples/Navbars/DashboardNavbar/index.js`: school name/logo and scroll color.
- `frontend/src/examples/Navbars/DashboardNavbar/styles.js`: responsive eduClub navbar states.
- `frontend/src/layouts/school-admin/courses/index.js`: assigned teacher controls and role-aware template actions.
- `frontend/src/layouts/course-builder/index.js`: teacher update request instead of sync/rollback.
- `frontend/src/layouts/learner/index.js`: overdue and due-this-week cards.
- `frontend/src/layouts/school-admin/reports/index.js`: feedback author display.

---

### Task 1: Add Assignment and Update-Request Schema

**Files:**
- Modify: `backend/src/database/schema.sql`
- Create: `backend/test/teacherSchema.test.js`

- [ ] **Step 1: Write failing schema tests**

Test that `schema.sql` contains:

```js
assert.match(schema, /CREATE TABLE IF NOT EXISTS course_teacher_assignments/);
assert.match(schema, /CREATE TABLE IF NOT EXISTS course_update_requests/);
assert.match(schema, /ENABLE ROW LEVEL SECURITY/);
assert.match(schema, /idx_course_teacher_assignments_teacher_active/);
```

- [ ] **Step 2: Run the focused test**

Run: `node --test test/teacherSchema.test.js`

Expected: FAIL because the tables do not exist.

- [ ] **Step 3: Add idempotent tables**

Add:

```sql
CREATE TABLE IF NOT EXISTS course_teacher_assignments (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deallocated_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(course_id, teacher_user_id)
);

CREATE TABLE IF NOT EXISTS course_update_requests (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_version INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(course_id, teacher_user_id, template_version)
);
```

Add active assignment indexes and RLS policies using `educlub_role()`,
`educlub_user_id()`, and `educlub_school_id()`.

Add learner graduation fields without changing existing active records:

```sql
ALTER TABLE learners ADD COLUMN IF NOT EXISTS graduation_status VARCHAR(20)
  NOT NULL DEFAULT 'active'
  CHECK (graduation_status IN ('active', 'graduated'));
ALTER TABLE learners ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMP;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS graduated_by_user_id INTEGER
  REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS graduation_note TEXT;
```

- [ ] **Step 4: Run schema and backend tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/schema.sql backend/test/teacherSchema.test.js
git commit -m "feat: add teacher course assignment schema"
```

### Task 2: Build Teacher Assignment Authorization

**Files:**
- Create: `backend/src/services/teacherAssignments.service.js`
- Create: `backend/test/teacherAssignments.test.js`

- [ ] **Step 1: Write failing pure-scope tests**

Cover:

```js
assert.equal(canManageTeacherAssignments(systemAdmin, course), true);
assert.equal(canManageTeacherAssignments(schoolAdmin, sameSchoolCourse), true);
assert.equal(canManageTeacherAssignments(schoolAdmin, otherSchoolCourse), false);
assert.equal(teacherRequiresAssignment({ role: "teacher" }), true);
```

Also test normalized IDs and inactive assignment rejection.

- [ ] **Step 2: Run the focused test**

Run: `node --test test/teacherAssignments.test.js`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement assignment service**

Export:

```js
async function listTeacherAssignments(filters, user)
async function assignTeacher({ courseId, teacherUserId, notes }, user)
async function deallocateTeacher(assignmentId, user)
async function isTeacherAssignedToCourse(teacherUserId, courseId)
async function assertTeacherCourseAccess(user, courseId)
async function listTeacherCourseIds(user)
async function assertTeacherLearnerAccess(user, learnerId)
async function requestTemplateUpdate(courseId, user)
```

`assignTeacher` verifies the course, teacher, and acting administrator all share
the same school. Reactivation updates the existing row instead of inserting a
new row.

- [ ] **Step 4: Run focused and full backend tests**

Run:

```bash
node --test test/teacherAssignments.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/teacherAssignments.service.js backend/test/teacherAssignments.test.js
git commit -m "feat: enforce teacher assignment scope"
```

### Task 3: Expose Staff and Assignment APIs

**Files:**
- Modify: `backend/src/controllers/users.controller.js`
- Modify: `backend/src/routes/users.routes.js`
- Create: `backend/src/controllers/teacherAssignments.controller.js`
- Create: `backend/src/routes/teacherAssignments.routes.js`
- Modify: `backend/src/server.js`
- Create: `backend/test/staffAccountScope.test.js`

- [ ] **Step 1: Write failing account-scope tests**

Test:

- system admin may create `school_admin` or `teacher`;
- school admin may create `teacher` only in `req.user.schoolId`;
- teacher cannot create staff;
- school admin cannot edit or deactivate another school's teacher;
- email becomes lowercase username.

- [ ] **Step 2: Run focused tests**

Run: `node --test test/staffAccountScope.test.js`

Expected: FAIL against the current system-admin-only controller.

- [ ] **Step 3: Replace `createSchoolAdmin` with role-aware staff creation**

Implement:

```js
async function createSchoolStaff(req, res) {
  const requestedRole = req.body.role;
  const schoolId =
    req.user.role === "school_admin" ? req.user.schoolId : req.body.school_id;

  if (!["school_admin", "teacher"].includes(requestedRole)) {
    return res.status(400).json({ error: "Choose School Admin or Teacher." });
  }
  if (req.user.role === "school_admin" && requestedRole !== "teacher") {
    return res.status(403).json({ error: "School administrators may create teachers only." });
  }
  // Insert user, optional school_admins row, welcome email, audit log.
}
```

Keep `/users/school-admins` as a compatibility wrapper and add
`POST /users/staff`, `GET /users/teachers`, `PUT /users/teachers/:id`, and
`DELETE /users/teachers/:id` with school scope.

- [ ] **Step 4: Add assignment routes**

Register:

```text
GET    /api/teacher-assignments
POST   /api/teacher-assignments
DELETE /api/teacher-assignments/:id
POST   /api/teacher-assignments/courses/:courseId/update-request
```

- [ ] **Step 5: Run backend tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/users.controller.js backend/src/routes/users.routes.js backend/src/controllers/teacherAssignments.controller.js backend/src/routes/teacherAssignments.routes.js backend/src/server.js backend/test/staffAccountScope.test.js
git commit -m "feat: add school scoped teacher accounts"
```

### Task 4: Enforce Assignment Scope Across Course Workflows

**Files:**
- Modify: `backend/src/services/courses.service.js`
- Modify: `backend/src/services/courseTemplates.service.js`
- Modify: `backend/src/controllers/allocations.controller.js`
- Modify: `backend/src/controllers/learners.controller.js`
- Modify: `backend/src/routes/learners.routes.js`
- Create: `backend/test/teacherWorkflowScope.test.js`

- [ ] **Step 1: Write failing workflow tests**

Cover:

- teacher sees only assigned courses;
- teacher cannot open, edit, grade, review, discuss, or report on unassigned courses;
- teacher can allocate only assigned courses;
- teacher may initially search active learners in their school;
- teacher may later view/promote only learners allocated to assigned courses;
- teacher may graduate only learners allocated to assigned courses;
- graduation records the acting user, time, and note without deleting history;
- teachers may view certificates for assigned learners but cannot approve or delete them;
- deallocation removes visibility but leaves learner allocations unchanged.

- [ ] **Step 2: Run focused tests**

Run: `node --test test/teacherWorkflowScope.test.js`

Expected: FAIL because current helpers treat all school staff equally.

- [ ] **Step 3: Update course access helpers**

Change `assertCourseManageAccess` and `assertCourseAccess`:

```js
if (user.role === "school_admin") {
  return course.school_id === user.schoolId;
}
if (user.role === "teacher") {
  return teacherAssignmentsService.isTeacherAssignedToCourse(user.userId, courseId);
}
```

Apply the helper to lists, builder, reviews, grading, discussions, schedules,
availability overrides, and reports.

- [ ] **Step 4: Restrict template actions**

Allow teachers to list templates and see update status, but require the exact
`school_admin` role for:

- adoption;
- synchronization;
- rollback.

Notify active assigned teachers when a newer template version exists.

- [ ] **Step 5: Restrict allocation and learner actions**

For teachers:

```sql
EXISTS (
  SELECT 1
  FROM course_teacher_assignments cta
  JOIN course_allocations ca ON ca.course_id = cta.course_id
  WHERE cta.teacher_user_id = $teacher
    AND cta.is_active = true
    AND ca.learner_id = l.id
)
```

Use the same relationship for progress, promotion, graduation, and report
access. Keep learner creation, bulk import, credentials, and password reset
school-admin-only.

- [ ] **Step 6: Add graduation endpoint**

Add `POST /learners/:id/graduate`. It updates:

```sql
graduation_status = 'graduated',
graduated_at = CURRENT_TIMESTAMP,
graduated_by_user_id = $actor,
graduation_note = $note
```

It does not delete allocations or progress. School administrators may graduate
school learners; teachers require assigned-course learner access.

- [ ] **Step 7: Run backend tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/courses.service.js backend/src/services/courseTemplates.service.js backend/src/controllers/allocations.controller.js backend/src/controllers/learners.controller.js backend/src/routes/learners.routes.js backend/test/teacherWorkflowScope.test.js
git commit -m "feat: scope teacher course workflows"
```

### Task 5: Add School Identity to Authentication

**Files:**
- Modify: `backend/src/services/auth.service.js`
- Create: `backend/test/authSchoolIdentity.test.js`
- Modify: `frontend/src/context/AuthContext.js`
- Modify: `frontend/src/lib/userDisplay.js`
- Create: `frontend/src/__tests__/schoolIdentity.test.js`

- [ ] **Step 1: Write failing identity tests**

Backend expects:

```js
expect(user.schoolName).toBe("Bright Academy");
expect(user.schoolLogoUrl).toBe("/uploads/school-logos/bright.png");
```

Frontend expects `getRoleLabel("teacher") === "Teacher"` and school identity
fallback to eduClub.

- [ ] **Step 2: Run focused tests**

Run:

```bash
node --test test/authSchoolIdentity.test.js
npm test -- --runInBand src/__tests__/schoolIdentity.test.js
```

Expected: FAIL.

- [ ] **Step 3: Join school identity in auth**

Create `loadUserWithSchool(userId)` selecting:

```sql
u.id, u.email, u.role, u.full_name, u.school_id, u.username,
u.force_password_reset, s.name AS school_name, s.logo_url AS school_logo_url
```

Use it for login response, MFA response, and current-user response.

- [ ] **Step 4: Persist frontend identity**

Normalize:

```js
{
  schoolName: user.schoolName || user.school_name || "",
  schoolLogoUrl: user.schoolLogoUrl || user.school_logo_url || ""
}
```

Add `isTeacher()` and make `isSchoolAdmin()` exact instead of including
teachers.

- [ ] **Step 5: Run tests**

Run backend and frontend test suites.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/auth.service.js backend/test/authSchoolIdentity.test.js frontend/src/context/AuthContext.js frontend/src/lib/userDisplay.js frontend/src/__tests__/schoolIdentity.test.js
git commit -m "feat: include school identity in sessions"
```

### Task 6: Build Staff Management and Course Assignment UI

**Files:**
- Modify: `frontend/src/layouts/system-admin/school-admins/index.js`
- Create: `frontend/src/layouts/school-admin/teachers/index.js`
- Modify: `frontend/src/layouts/school-admin/courses/index.js`
- Modify: `frontend/src/routes.js`
- Create: `frontend/src/__tests__/teacherManagement.test.js`

- [ ] **Step 1: Write failing UI helper tests**

Extract and test:

```js
staffPayload({ role, school, fullName, email })
assignmentOptions(teachers, assignments)
```

Ensure email is normalized and deallocated teachers become selectable again.

- [ ] **Step 2: Run focused test**

Run: `npm test -- --runInBand src/__tests__/teacherManagement.test.js`

Expected: FAIL.

- [ ] **Step 3: Upgrade system-admin staff screen**

Add role selector, retain school selector, and show role/status in the table.
Use `/users/staff`.

- [ ] **Step 4: Add school teacher screen**

Provide:

- teacher form with full name, email, contact;
- active/inactive status;
- reset-password action;
- assigned course count;
- edit/deactivate actions.

Do not expose school selection.

- [ ] **Step 5: Add course assignment dialog**

On each school course, add `Teachers` action opening a dialog with:

- searchable school teachers by name/email;
- active assignment list;
- assign button;
- deallocate button;
- audit-friendly confirmation text explaining that learners remain allocated.

- [ ] **Step 6: Run frontend tests and build**

Run:

```bash
npm test -- --runInBand
npm run build
```

Expected: tests and build PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/system-admin/school-admins/index.js frontend/src/layouts/school-admin/teachers/index.js frontend/src/layouts/school-admin/courses/index.js frontend/src/routes.js frontend/src/__tests__/teacherManagement.test.js
git commit -m "feat: manage teachers and course assignments"
```

### Task 7: Add Teacher Dashboard and Role-Specific Navigation

**Files:**
- Create: `frontend/src/layouts/teacher/index.js`
- Create: `backend/src/services/teacherDashboard.service.js`
- Create: `backend/src/controllers/teacherDashboard.controller.js`
- Create: `backend/src/routes/teacherDashboard.routes.js`
- Modify: `backend/src/server.js`
- Create: `backend/test/teacherDashboard.test.js`
- Modify: `frontend/src/routes.js`
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/layouts/school-admin/index.js`
- Create: `frontend/src/__tests__/teacherRoutes.test.js`

- [ ] **Step 1: Write failing route tests**

Verify teachers:

- redirect to `/teacher`;
- see teacher routes only;
- do not see School Settings or Teacher Management;
- can navigate to shared course/report screens under teacher-authorized routes.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- --runInBand src/__tests__/teacherRoutes.test.js`

Expected: FAIL because teachers currently share `/school-admin`.

- [ ] **Step 3: Add bounded teacher dashboard endpoint**

Return only assignment-scoped counts and short lists:

```js
{
  assigned_courses: [],
  assigned_learner_count: 0,
  submissions_waiting: 0,
  discussions_waiting: 0,
  template_updates: [],
  current_schedule: []
}
```

Use indexed assignment joins and limits of 8 items per list.

- [ ] **Step 4: Add teacher dashboard**

Load:

```js
apiClient.get("/teacher-dashboard")
```

Show assigned courses, pending reviews, assigned learners, discussions, update
notices, current schedule, and quick actions. Use responsive 2-column phone
statistics and unframed operational sections.

- [ ] **Step 5: Split route roles**

Make school-admin-only routes exact. Add teacher route labels:

- Dashboard
- My Courses
- Learners
- Allocations
- Reviews and Submissions
- Reports
- Typing / Quizzes
- Competitions
- Leaderboard
- Certificates for assigned learners

- [ ] **Step 6: Run tests and build**

Run frontend tests and production build.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/teacherDashboard.service.js backend/src/controllers/teacherDashboard.controller.js backend/src/routes/teacherDashboard.routes.js backend/src/server.js backend/test/teacherDashboard.test.js frontend/src/layouts/teacher/index.js frontend/src/routes.js frontend/src/App.js frontend/src/layouts/school-admin/index.js frontend/src/__tests__/teacherRoutes.test.js
git commit -m "feat: add teacher dashboard and navigation"
```

### Task 8: Add Teacher Template Update Request UI

**Files:**
- Modify: `frontend/src/layouts/school-admin/courses/index.js`
- Modify: `frontend/src/layouts/course-builder/index.js`
- Create: `frontend/src/__tests__/teacherTemplateUpdates.test.js`

- [ ] **Step 1: Write failing role-action tests**

Verify:

- school admin sees Adopt, Sync, and Rollback;
- teacher sees Update available and Request review;
- teacher never sees sync or rollback;
- repeated request displays already requested state.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- --runInBand src/__tests__/teacherTemplateUpdates.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement role-aware actions**

Teacher copy:

```text
Template update available.
Ask your school administrator to review and sync this update.
```

POST the request once and replace the action with `Request sent`.

- [ ] **Step 4: Run tests and build**

Run frontend tests and build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/school-admin/courses/index.js frontend/src/layouts/course-builder/index.js frontend/src/__tests__/teacherTemplateUpdates.test.js
git commit -m "feat: add teacher template update requests"
```

### Task 9: Add Learner Due-Work Aggregation

**Files:**
- Create: `backend/src/services/learnerDueWork.service.js`
- Create: `backend/src/controllers/learnerDashboard.controller.js`
- Create: `backend/src/routes/learnerDashboard.routes.js`
- Modify: `backend/src/server.js`
- Create: `backend/test/learnerDueWork.test.js`
- Modify: `frontend/src/layouts/learner/index.js`
- Create: `frontend/src/__tests__/learnerDueWork.test.js`

- [ ] **Step 1: Write failing due-work tests**

Use pure grouping fixtures to verify:

- incomplete work in the active week is `due_this_week`;
- incomplete earlier work is `overdue`;
- future and completed work are excluded;
- typing and quiz items use their term-week dates;
- course activity includes the active assigned teacher name.

- [ ] **Step 2: Run focused tests**

Run backend and frontend focused tests.

Expected: FAIL.

- [ ] **Step 3: Implement learner aggregation**

Return:

```js
{
  overdue: [{ id, kind, title, course_name, module_title, teacher_name, starts_at, ends_at, href }],
  due_this_week: [...]
}
```

Resolve the learner from `userId`, use the active term and `term_weeks`, and
query existing activity progress, quiz attempts, and typing completion data.

- [ ] **Step 4: Add responsive dashboard cards**

Display `Overdue` first, then `Due this week`. Each card has type color, teacher
name, date/week, status, and Continue button. Use one column on phones and two
columns where space allows.

- [ ] **Step 5: Run tests and build**

Run both full test suites and frontend build.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/learnerDueWork.service.js backend/src/controllers/learnerDashboard.controller.js backend/src/routes/learnerDashboard.routes.js backend/src/server.js backend/test/learnerDueWork.test.js frontend/src/layouts/learner/index.js frontend/src/__tests__/learnerDueWork.test.js
git commit -m "feat: show learner due work"
```

### Task 10: Attribute Report Feedback to Staff

**Files:**
- Modify: `backend/src/services/reports.service.js`
- Modify: `frontend/src/layouts/school-admin/reports/index.js`
- Create: `backend/test/reportFeedbackAuthor.test.js`
- Create: `frontend/src/__tests__/reportFeedbackAuthor.test.js`

- [ ] **Step 1: Write failing author tests**

Verify the latest updating user produces:

```js
{
  updated_by_name: "Jane Wanjiku",
  updated_by_role: "teacher",
  author_label: "Teacher Feedback - Jane Wanjiku"
}
```

- [ ] **Step 2: Run focused tests**

Run backend and frontend focused tests.

Expected: FAIL because role is not currently selected or displayed.

- [ ] **Step 3: Add backend role and access checks**

Join `u.role AS updated_by_role`. Before saving teacher feedback call
`assertTeacherLearnerAccess`; school administrators retain school-wide access.
Use the same author fields in PDF generation.

- [ ] **Step 4: Display author**

Render the author label beside feedback in staff and learner report views and
in the generated PDF.

- [ ] **Step 5: Run tests**

Run both full test suites.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/reports.service.js backend/test/reportFeedbackAuthor.test.js frontend/src/layouts/school-admin/reports/index.js frontend/src/__tests__/reportFeedbackAuthor.test.js
git commit -m "feat: attribute report feedback to staff"
```

### Task 11: Apply Responsive School Branding

**Files:**
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/examples/Sidenav/index.js`
- Modify: `frontend/src/examples/Navbars/DashboardNavbar/index.js`
- Modify: `frontend/src/examples/Navbars/DashboardNavbar/styles.js`
- Modify: `frontend/src/components/DashboardIdentity/index.js`
- Create: `frontend/src/__tests__/responsiveSchoolBranding.test.js`

- [ ] **Step 1: Write failing branding tests**

Verify:

- school logo/name win for school users;
- eduClub fallback is used without school branding;
- teacher role label exists;
- compact phone identity hides secondary text before school name.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- --runInBand src/__tests__/responsiveSchoolBranding.test.js`

Expected: FAIL.

- [ ] **Step 3: Brand sidebar and navbar**

Pass:

```jsx
<Sidenav
  brand={user?.schoolLogoUrl || eduClubLogo}
  brandName={user?.schoolName || "eduClub LMS"}
  platformName={user?.schoolName ? "Powered by eduClub" : ""}
/>
```

Add a school logo/name block to the navbar. At scroll position zero use a light
surface; after scrolling use eduClub blue with white identity and green active
accent.

- [ ] **Step 4: Make identity responsive**

Use stable max widths, ellipsis, `xs/sm/md` visibility, 44px touch targets, and
no viewport-scaled font sizes.

- [ ] **Step 5: Run tests and build**

Run frontend tests and production build.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js frontend/src/examples/Sidenav/index.js frontend/src/examples/Navbars/DashboardNavbar/index.js frontend/src/examples/Navbars/DashboardNavbar/styles.js frontend/src/components/DashboardIdentity/index.js frontend/src/__tests__/responsiveSchoolBranding.test.js
git commit -m "feat: add responsive school branding"
```

### Task 12: Migrate and Verify End to End

**Files:**
- Modify only if verification finds defects.

- [ ] **Step 1: Run complete verification**

```bash
cd backend && npm test
cd ../frontend && npm test -- --runInBand
npm run build
```

Expected: all tests and build PASS.

- [ ] **Step 2: Run additive migration**

Run from repository root:

```bash
node scripts/migrate.js
```

Expected: migration completes without deleting or truncating existing data.

- [ ] **Step 3: Verify database invariants**

Query counts before and after for:

- users;
- learners;
- courses;
- course allocations;
- activity progress;
- activity submissions;
- activity grades.

Expected: unchanged except newly created assignment/request records.

- [ ] **Step 4: Browser verification**

Verify at phone, tablet, laptop, and wide desktop:

- system admin creates teacher;
- school admin creates teacher;
- school admin assigns and deallocates course;
- teacher sees only assigned course;
- teacher requests template update;
- learner sees overdue/due-this-week work;
- report feedback shows author;
- school logo/name and scroll navbar render without overlap.

- [ ] **Step 5: Final commit for verification fixes**

Only if fixes were required:

```bash
git add <verified-fix-files>
git commit -m "fix: complete teacher dashboard verification"
```

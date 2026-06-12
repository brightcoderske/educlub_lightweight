# Course Builder Authoring Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace course-builder prompts with focused dialogs while enforcing school-scoped learner access and preserving existing course content and progress.

**Architecture:** Add small pure authoring helpers and four focused React dialogs under the course builder. Keep the existing activity HTML format and availability-override API, with learner IDs used only inside submitted payloads. Fix learner list authorization at the backend boundary before the dialog consumes it.

**Tech Stack:** Node.js, Express, PostgreSQL, React 18, Material UI, Jest, Node test runner.

---

### Task 1: Enforce School-Scoped Learner Lists

**Files:**
- Create: `backend/src/services/learnerScope.js`
- Create: `backend/test/learnerScope.test.js`
- Modify: `backend/src/controllers/learners.controller.js`

- [ ] Write failing tests proving `teacher` and `school_admin` always resolve to their authenticated `schoolId`, while system admins may request a school.
- [ ] Run `npm test` from `backend` and confirm the new tests fail because the helper is missing.
- [ ] Implement `resolveLearnerSchoolScope(user, requestedSchoolId)` and apply it in `getAllLearners`.
- [ ] Permit teacher learner-list access but prevent client parameters from expanding school scope.
- [ ] Run `npm test` and confirm all backend tests pass.

### Task 2: Add Tested Authoring Helpers

**Files:**
- Create: `frontend/src/layouts/course-builder/dialogs/authoringUtils.js`
- Create: `frontend/src/__tests__/courseBuilderDialogs.test.js`

- [ ] Write failing tests for HTTP/HTTPS URL validation, safe HTML escaping, executable-block serialization/parsing, display-code serialization, and early-unlock payload creation.
- [ ] Run `npm test -- --runInBand courseBuilderDialogs.test.js` from `frontend` and confirm failure.
- [ ] Implement the helpers using the existing `data-executable-code` contract.
- [ ] Ensure learner names never enter the payload as authorization identifiers; selected learner objects map internally to numeric IDs.
- [ ] Re-run the focused frontend test and confirm it passes.

### Task 3: Build Focused Dialog Components

**Files:**
- Create: `frontend/src/layouts/course-builder/dialogs/EarlyUnlockDialog.js`
- Create: `frontend/src/layouts/course-builder/dialogs/ResourceDialog.js`
- Create: `frontend/src/layouts/course-builder/dialogs/ExecutableCodeDialog.js`
- Create: `frontend/src/layouts/course-builder/dialogs/DisplayCodeDialog.js`

- [ ] Build an early-unlock dialog with name/username search, visible grade/stream context, removable learner selections, class targeting, reason validation, and no visible IDs.
- [ ] Build one resource dialog with link, online-image, and video/resource modes plus type-specific fields and URL validation.
- [ ] Build one dark executable web-code editor with Run, white sandboxed preview, Reset, and Insert/Update.
- [ ] Build a non-executable display-code dialog with title, language, and one code editor.
- [ ] Keep all dialogs responsive and disable submission while invalid or saving.

### Task 4: Integrate Dialogs Into Rich Content Editing

**Files:**
- Modify: `frontend/src/layouts/course-builder/index.js`

- [ ] Replace link, online-image, external-resource, executable-code, and display-code prompt flows with dialog state and callbacks.
- [ ] Preserve and restore the editor selection before inserting new content.
- [ ] Add Edit for selected executable/display-code blocks so updates replace the existing node.
- [ ] Replace the 2 MB upload alert with an inline editor error.
- [ ] Remove every `window.prompt` call from the course builder.

### Task 5: Integrate Early Unlock And Feedback Navigation

**Files:**
- Modify: `frontend/src/layouts/course-builder/index.js`

- [ ] Replace early-unlock prompts with `EarlyUnlockDialog`.
- [ ] Load learners from `/learners`; backend scoping supplies only the authenticated school.
- [ ] Submit the existing availability-override payload and retain success/error messages.
- [ ] Replace the module-feedback alert with navigation to the existing course review page.
- [ ] Keep templates excluded from school unlock and feedback actions.

### Task 6: Verify And Integrate

**Files:**
- Verify all modified files.

- [ ] Run backend tests with `npm test`.
- [ ] Run frontend tests with `npm test -- --runInBand`.
- [ ] Run focused Prettier checks and `npm run build`.
- [ ] Confirm `rg "window\\.prompt" frontend/src/layouts/course-builder` returns no matches.
- [ ] Browser-check resource insertion, executable preview, early learner selection, desktop layout, and mobile overflow.
- [ ] Review `git diff --check`, commit the feature, merge it into `main`, and push only after all checks pass.

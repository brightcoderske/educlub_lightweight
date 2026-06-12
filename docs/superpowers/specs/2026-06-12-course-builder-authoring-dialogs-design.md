# Course Builder Authoring Dialogs Design

## Goal

Replace browser prompts and alerts in the course builder with safe,
teacher-friendly dialogs without changing stored course content, learner
progress, progressive unlocking, module badges, or coding behavior.

## Scope

The work includes:

- An early-unlock dialog.
- A resource insertion dialog for links, online images, and videos/resources.
- A single-editor executable web-code dialog.
- A normal display-code dialog with language selection.
- A module-feedback dialog or direct route to the existing course review page.
- Strict school scoping for teacher and school-admin learner access.

No database migration is required.

## Early Unlock

Teachers and school administrators select:

- One learner.
- Multiple learners.
- A class using grade and optional stream.

The dialog loads only learners from the authenticated user's school. Learners
are searchable by name or username and displayed with their grade and stream.
Database IDs are never displayed or manually entered; selected records submit
their IDs internally to the existing availability-override endpoint.

The dialog also displays the affected course module or activity and requires a
reason before saving.

The backend must treat both `teacher` and `school_admin` as school-scoped roles.
Client-provided school IDs cannot expand access.

## Resource Insertion

One resource dialog supports:

- Standard links.
- Online images.
- Video or external learning resources.

Fields change according to resource type. URLs accept only `http` and `https`.
Links support display text. Images require alternative text. External
resources support a useful button label.

Existing local image upload remains capped at 2 MB. Upload errors are shown
inside the editor interface instead of with `window.alert`.

Inserted content is placed at the teacher's last editor selection.

## Executable Web Code

Executable HTML/CSS/JavaScript uses one code editor, not separate editors.
Teachers can enter a complete web snippet or document containing HTML,
`<style>`, and `<script>` sections.

The dialog provides:

- A dark monospace editor.
- Run/Preview.
- A white sandboxed output panel.
- Reset and Insert/Update actions.

Selecting an existing executable block and choosing Edit reopens the dialog
with its current source. Updating replaces the selected block rather than
adding a duplicate.

## Display Code

The display-code dialog contains:

- Optional title.
- Language selector.
- One code editor.
- Insert or Update action.

It produces a non-executable code block for lessons and explanations. Inline
code remains a direct toolbar action.

## Module Feedback

The current feedback alert is removed. The course builder action either opens
a compact module-feedback dialog or navigates to the existing course review
page. The recommended implementation is navigation to the review page because
it already contains filters, module ratings, anonymous comments, and
role-appropriate access.

## Structure

New focused components live under:

`frontend/src/layouts/course-builder/dialogs/`

Small pure helpers for URL validation, code-block serialization, and insertion
content live beside the dialogs and receive unit tests. The main course-builder
file owns dialog state and passes insertion callbacks, avoiding a broad builder
rewrite.

## Safety And Compatibility

- Existing activity IDs and content JSON remain unchanged.
- Existing HTML produced by the editor remains readable.
- Existing executable blocks remain compatible.
- Progressive availability, badges, submissions, grades, and learner progress
  are untouched.
- Dialog validation prevents empty reasons, invalid URLs, empty learner
  selections, and empty code blocks.

## Verification

- Backend tests prove teachers and school administrators cannot list learners
  outside their school.
- Frontend tests cover URL validation, code serialization, selected-learner
  payloads, and existing executable-block editing.
- Production build and responsive browser checks verify the dialogs on desktop,
  tablet, and mobile.
- The final course-builder source contains no `window.prompt` calls.

# Course Version Reviews Design

## Purpose

Give system administrators and school teaching staff a useful view of learner
course reviews without adding another main navigation section or exposing
learner identities unnecessarily.

## Entry Points

- Add a `Reviews` action to each course in the system-admin course list.
- Add the same action to school-admin and teacher course lists.
- The action opens a dedicated review page for the selected course.
- System administrators see every school version adopted from the selected
  template.
- School administrators and teachers see only their school's course version.

## System Administrator View

The template-level page shows:

- Overall template rating and total response count.
- Number of schools that adopted the course.
- A rating distribution and count of modules needing attention.
- The first ten school versions, ordered by review activity, with search and
  pagination for the remaining versions.
- Each row includes the school, school course version, review count, overall
  course rating, and lowest module rating.
- Low-rated school versions and modules are visually highlighted.

Opening a school version reveals its course-level report:

- Overall rating and rating distribution.
- Module-by-module average ratings and response counts.
- Anonymous comments with module, rating, and submission date.
- Filters for module, rating, and date.
- An audited `Reveal identity` action available only to system administrators.
  The administrator must provide a reason before the learner identity is shown.

## School Administrator And Teacher View

School administrators and teachers use the same school-version report layout.
The backend always derives their school from the authenticated user, so query
parameters cannot expand their access.

They can see:

- Their course version's overall rating.
- Module ratings, response counts, distributions, and anonymous comments.
- Filters for module, rating, and date.

They cannot reveal learner identities.

## Backend Design

Add read endpoints for:

- A system-admin template review summary with searchable, paginated school
  versions.
- A school-version review report containing aggregates, module summaries, and
  paginated anonymous feedback.

The existing audited identity-reveal endpoint remains the only route that
returns learner identity. Existing feedback and identity-audit tables are
reused, so no database migration is expected.

Queries aggregate ratings in PostgreSQL and return only the requested page.
Data loads when the report opens or a filter changes. There is no polling.

## Authorization And Privacy

- Template-wide reporting requires the `system_admin` role.
- School-version reporting allows `system_admin`, `school_admin`, and
  `teacher`.
- School administrators and teachers are restricted to `req.user.schoolId`.
- Comments remain anonymous in normal report responses.
- Identity reveals require a non-empty reason and retain the existing audit
  record.
- Empty, deleted, or inaccessible course versions return clear not-found or
  forbidden responses without leaking their existence.

## Frontend Design

Use the existing system-admin and school course-list patterns. The report is a
normal responsive page, not a modal, because module breakdowns and comments
need enough reading space.

Desktop uses compact summary metrics, a school-version table, module rows, and
a feedback table. Mobile converts rows into readable stacked items and keeps
filters horizontally compact without page overflow.

Ratings use restrained status colors:

- Strong ratings: green.
- Ratings needing observation: amber.
- Low ratings: red.
- No responses: neutral gray.

## Error And Empty States

- Show a concise retry state when a report request fails.
- Show `No reviews yet` without treating it as an error.
- Keep the current report visible while filter requests are loading where
  practical.
- Failed identity reveals do not expose partial learner details.

## Testing

- Backend authorization tests for all three roles and cross-school denial.
- Aggregate and pagination tests, including courses with no feedback.
- Identity reveal reason and system-admin-only tests.
- Frontend tests for course actions, report rendering, filtering, empty states,
  low-rating highlighting, and role-specific identity controls.
- Production build and responsive browser verification before release.

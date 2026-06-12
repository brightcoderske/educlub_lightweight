# Teacher Accounts and Dashboard Design

## Goal

Add a secure, school-scoped teacher role without changing the existing school
administrator role. Teachers receive only assigned courses, can work with
learners through those courses, and lose all course visibility immediately
when deallocated.

The change must preserve existing schools, users, course versions, learner
allocations, progress, grades, badges, and reports.

## Approaches Considered

### 1. Give teachers the existing school-admin interface

This is the smallest UI change, but it exposes school-wide pages and makes
permission mistakes likely. The current code already treats teachers as school
administrators in several helpers, so keeping this approach would preserve an
unsafe boundary.

### 2. Create an entirely separate teacher application

This gives strong separation but duplicates course, learner, report, grading,
and discussion screens. It would increase maintenance and resource usage.

### 3. Recommended: shared components with explicit role and assignment scope

Teachers receive a distinct dashboard and navigation. Existing course, report,
grading, and learner components are reused where appropriate, while backend
authorization applies teacher-course and learner scope. This provides clear
permissions without duplicating the LMS.

## Account Management

Email is the teacher's login identifier and username. Email comparison is
case-insensitive and globally unique.

System administrators can create school staff for any school and choose:

- School Administrator
- Teacher

School administrators can create, edit, deactivate, and send password-reset
emails only for teachers in their own school. Teachers cannot create or manage
staff.

New accounts:

- are linked to one school;
- receive the selected role;
- use the lowercase email as username;
- require password change on first login;
- receive the existing welcome/password email flow;
- are recorded in the audit log.

School administrators retain their current permissions and school-settings
access. Teachers never receive school-settings or staff-management access.

## Course Assignment

Add an additive `course_teacher_assignments` table containing:

- school course ID;
- teacher user ID;
- assigning user ID;
- active status;
- assigned and deallocated timestamps;
- optional notes;
- uniqueness for one active teacher/course relationship.

Only system administrators and the course's school administrators can assign or
deallocate teachers. A course may have multiple teachers.

Deallocation:

- immediately removes the course from teacher lists and API access;
- removes editing, grading, discussion, allocation, review, and report access;
- does not alter learner course allocations;
- does not remove learner progress, submissions, marks, badges, or feedback;
- is audited.

## Teacher Permissions

Teachers can perform these actions only for active course assignments in their
school:

- view and edit the school-owned course version;
- manage modules, activities, schedules, early unlocks, and discussions;
- allocate their assigned courses to school learners;
- review submissions and adjust grades;
- view course reviews and reports;
- write learner report-card feedback;
- promote or graduate learners attached to at least one assigned course.

For initial allocation, the learner picker may list active learners from the
teacher's school using name, username, grade, and stream. After allocation,
learner profiles, progress, reporting, promotion, and graduation are restricted
to learners attached to the teacher's assigned courses.

Teachers cannot:

- adopt templates;
- synchronize or roll back template updates;
- assign teachers;
- manage school identity or settings;
- create or manage staff;
- access unassigned courses or their learners.

All restrictions are enforced in backend services and routes. Hiding navigation
items is not treated as authorization.

## Template Updates

School administrators remain responsible for template adoption,
synchronization, and rollback.

Teachers assigned to an affected course see:

- an update badge on their course;
- one notification for each new template version;
- a note explaining that the school administrator must review and sync it;
- an action to send one deduplicated update request to the school administrator.

Synchronization keeps the existing non-destructive behavior:

- template-linked modules and activities update in place;
- IDs remain stable;
- school-created modules and activities remain;
- learner progress and submissions remain;
- changes are audited.

## Teacher Dashboard

The teacher dashboard prioritizes daily work:

- assigned courses;
- submissions awaiting review;
- learners needing attention;
- discussions with new replies;
- template updates awaiting school-admin action;
- current-week teaching schedule;
- quick actions for allocation, grading, reports, and course building.

Teacher navigation contains only:

- Dashboard
- My Courses
- Learners
- Allocations
- Reviews and Submissions
- Reports
- Typing and Quizzes
- Competitions
- Leaderboard
- Certificates, where permitted

School Settings and staff management are excluded.

## Learner Due Work

Add a lightweight learner due-work endpoint calculated when the dashboard is
loaded. It does not require scheduled jobs or polling.

The endpoint combines:

- incomplete required activities in modules scheduled for the current week;
- incomplete weekly quizzes;
- incomplete weekly typing work;
- unfinished work from earlier weeks marked `Overdue`.

Each item includes:

- title and type;
- course and module;
- assigned teacher name when available;
- week/date window;
- completion state;
- destination URL.

The learner dashboard displays `Overdue` first, followed by `Due this week`.
Completed items are excluded. Existing short dashboard caching may include the
result and refresh quietly.

## Report-Card Feedback

The existing report feedback record already stores the creating and last
updating user. Report views and generated PDFs will display the actual latest
author's name and role.

Examples:

- `Teacher Feedback - Jane Wanjiku`
- `School Administrator Feedback - Charles Mwangi`

Teachers may write feedback only for learners attached to their assigned
courses. School administrators retain school-wide feedback access.

## School Identity and Navigation

Authentication responses include the user's school name and logo URL.

For school administrators, teachers, and learners:

- the sidebar uses the school logo when available;
- the school name replaces the generic `eduClub LMS` sidebar title;
- the navbar displays school name, user name, and role;
- eduClub remains visible as the platform identity in a small secondary label;
- missing logos fall back to the eduClub logo.

The navbar uses restrained eduClub blue and green accents. At the top it remains
light and readable; after scrolling it becomes a stronger blue surface with
white text and icons.

Responsive behavior:

- compact logo and school-name truncation on phones;
- role and secondary platform text may collapse before primary identity;
- navigation remains touch-friendly;
- tables use responsive cards or horizontal containment where necessary;
- no identity text overlaps controls at phone, tablet, laptop, or wide desktop
  sizes.

## Data Security and RLS

The migration is additive and idempotent.

RLS and backend checks enforce:

- system administrators may manage all teacher assignments;
- school administrators may manage assignments only for their school;
- teachers may read only their active assignments;
- teacher course access requires both matching school ID and active assignment;
- teacher learner/report access requires an assigned-course relationship;
- deallocated assignments stop granting access immediately.

Database IDs remain internal. Teacher-facing selection uses names, usernames,
course names, grades, and streams.

## Error Handling

- Duplicate staff emails return a clear conflict message.
- Assignment rejects users who are not active teachers in the course's school.
- Deallocation of an already inactive assignment is idempotent.
- Teacher access to an unassigned course returns `403`.
- Update requests are deduplicated by course, template version, and requesting
  teacher.
- Branding failures fall back to eduClub identity without blocking login.

## Testing

Backend tests cover:

- account-creation role and school scope;
- teacher assignment and deallocation;
- assigned-course authorization;
- assigned-learner report and promotion scope;
- update-request deduplication;
- non-destructive template synchronization;
- due-work current and overdue calculations;
- report-feedback author attribution.

Frontend tests cover:

- role-specific routes and navigation;
- school identity fallback and responsive truncation;
- teacher course visibility after assignment/deallocation;
- update request UI;
- learner due-work grouping;
- report feedback author labels.

Production builds and responsive browser checks will verify phone, tablet,
laptop, and wide desktop layouts.

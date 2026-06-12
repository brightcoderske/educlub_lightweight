# Progressive Learning, Executable Coding, Badges, and Module Feedback

Date: 2026-06-12

## Objective

Extend eduClub with progressive activity access, school-controlled module scheduling, optional practice, true/false questions, browser-executable coding, durable module badges, and anonymous module feedback.

The implementation must preserve all existing courses, school course versions, activities, learner progress, submissions, grades, and identifiers.

## Compatibility Guarantees

- All database changes are additive and idempotent.
- Existing course, module, activity, progress, submission, and grade rows are not deleted, recreated, or renumbered.
- Existing modules without a school schedule remain available according to current publication and unlock behavior.
- Existing activities default to required and retain their current position.
- Existing progress continues to determine whether an activity is complete.
- Existing courses require no manual conversion.
- Badge and feedback backfills only read existing completed-module and grade data.
- Course-template changes continue to sync through the existing school-version workflow without removing school additions.

## Learning Progression

### Required activities

Published required activities unlock in module position order. The first required activity is available when the module is available. Each subsequent required activity becomes available after the preceding required activity is complete.

An activity remains available after it has unlocked. Editing its content must update the existing activity row rather than creating a replacement, preserving submissions and progress.

### Optional Try More activities

Teachers may mark an activity as `Try More`. These activities:

- Support the existing lesson, research, discussion, assignment, project, reflection, quiz, and coding experiences.
- Appear as visually distinct optional cards.
- Can record progress, submissions, feedback, and grades normally.
- Do not block the next required activity.
- Do not count toward required module completion unless this behavior is explicitly changed in a future design.
- Become available when the module is available, unless the teacher gives the activity a later opening rule.

The activity record receives an additive availability classification with a backward-compatible default of `required`.

## School Module Availability

Scheduling belongs to the adopted school course version, not the system template.

A teacher or school administrator may assign a module:

- An active academic term.
- An opening week within that term.
- An optional opening time, defaulting to the start of the first day of the selected week.

The module opens at the beginning of the configured week and remains open through the rest of the term and afterward while the school course remains accessible. The end of the selected week does not close it.

Week dates are calculated using the existing academic-term week calculation so weekly quizzes, typing tests, and course modules share one source of truth.

Modules with no schedule retain existing availability behavior. Template modules do not carry school dates.

### Early unlock overrides

Authorized teachers and school administrators may unlock a module or activity early for:

- The whole allocated class.
- A selected group of learners.
- One learner.

An override records its scope, target, course/module/activity, creator, reason, and timestamps. It only changes availability. It never creates progress or marks content complete.

Overrides are school-scoped, enforced by application authorization and row-level security, and displayed in an audit history.

## Quiz Question Types

True/false questions are supported consistently in:

- Course activity quizzes.
- Weekly quizzes.
- Competition quizzes.

The author selects the correct value using two clear choices rather than entering text. The server normalizes answers to booleans before comparison and uses the question's configured points when awarding marks.

Existing single choice, multiple choice, short answer, matching, and ordering behavior remains unchanged. Weekly quiz database constraints are extended additively to accept `true_false`.

## Coding Challenges

### Challenge modes

Coding activities support:

- **Build:** write code to satisfy a stated goal.
- **Complete:** finish a partially provided solution.
- **Debug:** find and correct mistakes in starter code.

The first executable runtime supports browser-safe HTML, CSS, and JavaScript as one coordinated project. Other language labels may remain available for display and teacher review, but they are not executed or automatically marked in this phase.

### Learner workspace

The learner receives dark editable code panels and a separate light output area. The output remains hidden until **Run** is selected. Running code does not submit the activity.

The preview executes in a sandboxed iframe without same-origin access. The runtime must not send executable learner code to the application server. Network access and dangerous browser capabilities are restricted as far as the selected iframe sandbox permits.

The learner may run repeatedly, reset to starter code, and submit the current code. Existing submission and teacher-review workflows remain the source of record.

### Automatic checks

An examiner may configure deterministic checks such as:

- An element matching a selector exists.
- Text equals or contains an expected value.
- An attribute or CSS property has an expected value.
- Expected visible output is present.
- A required JavaScript behavior succeeds in a controlled test harness.

Checks have individual marks whose total cannot exceed the activity's configured maximum. Private checks are not exposed to the learner before submission. Public checks may provide learning guidance while running.

The server calculates authoritative automatic marks only for checks it can verify through safe HTML/CSS parsing, restricted JavaScript syntax analysis, and other non-executing validators. It never executes arbitrary learner code inside the backend process. Browser runtime and behavior checks provide learner feedback and teacher review evidence but are not trusted by themselves for authoritative grading. Teacher review may adjust the final grade through the existing grading system. Subjective tasks and unsupported languages remain teacher-marked.

## Executable Lesson Code

The rich-text editor gains a structured executable-code block rather than inserting unrestricted script tags into lesson HTML.

Each block stores:

- Language/runtime, initially HTML/CSS/JavaScript.
- HTML, CSS, and JavaScript source.
- Optional title and instructions.
- Whether learners may edit a temporary working copy before running.

Learners see formatted source and a **Run** action. The output panel is created and shown only after Run. Editable lesson experiments remain temporary and do not become submissions unless the block is part of a coding activity.

The block is selectable and removable in the editor like other embedded objects. Lesson rendering continues to sanitize ordinary rich content.

## Module Badges

### Tiers

Every completed module receives exactly one badge:

- Below 71%: black **Completion** badge.
- 71% through 80%: **Bronze**.
- Above 80% through 90%: **Silver**.
- Above 90% through 100%: **Gold**.

Boundary calculations use the unrounded module percentage; display values may be rounded.

### Award lifecycle

A durable module-award record is uniquely identified by learner and school-course module. It stores the current tier, qualifying score, course and allocation context, and award/update timestamps.

The award is upserted when:

- A module first becomes complete.
- A quiz or automatically marked coding challenge changes the module score.
- A teacher creates or adjusts an activity grade.
- Module progress is recalculated.

A changed grade updates the existing award instead of issuing a duplicate. If a completed module falls below a medal threshold, its record becomes the Completion tier. A module that is no longer complete due to an administrative content change keeps its historical record flagged as pending recalculation and is not displayed as a newly earned duplicate.

Badges accumulate across terms, years, courses, and school course versions. They appear on:

- The learner dashboard, with a compact recent-badges summary and lifetime totals.
- The certificates/badges tab, grouped and filterable by year, term, course, and tier.
- The module-completion congratulations view.

Existing thematic module badge names may be retained as the badge title, while Completion/Bronze/Silver/Gold supplies the achievement tier and color.

## Module Feedback

After module completion, the learner may submit:

- A required 1-to-5 star rating.
- An optional comment.

One feedback record exists per learner and school-course module. The learner may update it. Feedback is linked to the module version so template and school-version changes can be analyzed accurately.

Teachers and school administrators see only feedback from their school, with learner identity hidden. They can view average rating, response count, distribution, trends, and anonymized comments.

System administrators see cross-school aggregates and anonymized comments. Identity reveal is allowed only through a moderation action requiring a reason. Every reveal records the administrator, reason, feedback record, and time.

Row-level security prevents school users from reading another school's feedback or moderation records.

## Data Model

The detailed implementation plan may adapt names to existing conventions, but the design requires these additive concepts:

- School module schedule, keyed to the adopted school module and academic term/week.
- Activity availability mode, defaulting to `required`.
- Availability override records with class/group/learner scope and audit fields.
- Learner module awards with a unique learner/module constraint.
- Module feedback with a unique learner/module constraint.
- Feedback identity-access audit records.
- Structured coding challenge configuration and validation checks, stored using the existing activity-content pattern unless query or security requirements justify normalized child rows.

Indexes cover learner/module awards, school/module feedback aggregation, active schedules, and override target lookups.

New tables receive row-level security policies consistent with existing user roles and school boundaries.

## Service Boundaries

- **Availability service:** resolves publication, school schedule, prerequisite completion, optional activity behavior, and overrides into one access decision.
- **Coding evaluation service:** validates challenge configuration, safely parses submitted source, and calculates authoritative results without executing arbitrary learner code on the application server.
- **Badge service:** derives the module score and idempotently upserts the learner's single module award.
- **Feedback service:** enforces completion, anonymity, school scope, aggregation, and audited moderation access.

Course controllers consume these services rather than duplicating rules in individual endpoints.

## Performance

- Browser execution consumes learner-device resources rather than backend compute.
- Access decisions use indexed schedule, override, and progress lookups.
- Badges are materialized once and updated on relevant events instead of recalculated across a learner's lifetime on every dashboard load.
- Feedback dashboards use aggregate queries and pagination for comments.
- Award recalculation is idempotent and limited to the affected learner/module.
- No polling is required for schedules, badges, or feedback.

## Failure Handling

- Invalid week/term combinations are rejected before saving.
- A locked activity returns a structured reason and prerequisite information.
- Failed code execution remains local to the sandbox and cannot submit automatically.
- Invalid or over-allocated coding checks cannot be published.
- Badge recalculation failure does not roll back a successfully stored learner submission or teacher grade; it is logged and safely retried.
- Feedback identity access without an authorized moderation reason is denied and audited as a rejected attempt where practical.

## Migration and Backfill

1. Add new columns, tables, constraints, indexes, and row-level security policies without dropping existing objects.
2. Set compatibility defaults for existing activities and modules.
3. Extend weekly quiz constraints to accept true/false.
4. Backfill one badge for each currently completed learner/module using current authoritative grades and progress.
5. Do not backfill feedback, schedules, optional activities, or overrides.
6. Make migration rerunnable using `IF NOT EXISTS`, guarded constraint replacement, and conflict-safe upserts.
7. Validate row counts and foreign-key integrity before and after migration.

## Verification

### Backend

- Existing course and progress counts are unchanged after migration.
- Existing unscheduled modules remain available.
- Required activity progression and optional Try More behavior are enforced.
- Term/week schedules open at the correct boundary and never close after the week.
- Class and learner overrides are school-scoped and audited.
- True/false questions award configured points in every quiz family.
- Coding checks calculate marks correctly and teacher overrides remain authoritative.
- One learner/module award is updated across regrading without duplicates.
- Feedback anonymity and moderation auditing are enforced.

### Frontend

- Builders expose true/false, coding modes, executable lesson blocks, schedules, and Try More clearly.
- Locked activities explain what must be completed or when content opens.
- Try More cards are visually distinct on mobile, tablet, and desktop.
- Code runs in the sandbox, with output hidden before Run.
- Badge colors, tier names, lifetime totals, and congratulations displays agree.
- Anonymous feedback reports remain readable at school and system scopes.

### Regression

- Existing course building, template adoption, template synchronization, learner progress, quiz submission, teacher grading, report cards, weekly learning, and competition flows continue to pass.
- Editing an activity updates the same row and preserves learner history.
- No existing course requires a schedule or optionality migration to remain usable.

# eduClub Standalone LMS Roadmap

This project is a lightweight, self-hosted eduClub LMS.

## Direction

eduClub should run as its own school-focused learning platform:

- Schools manage learners, teachers, classes, courses, reports, and certificates.
- Courses contain modules.
- Modules contain activities.
- Activities drive learner progress, submissions, grades, discussions, typing, coding, and certificates.
## Current Foundation

- Course creation is native and stores eduClub course metadata.
- The schema now includes native `course_modules`, `learning_activities`, `activity_progress`, submissions, grades, quiz questions, quiz attempts, discussions, and replies.
- Allocations are local eduClub course enrollments.
- Progress is calculated from native modules and activity progress.

## Next Build Steps

1. Build the course builder API for modules and activities.
2. Add a system admin course builder UI with module ordering and activity type selection.
3. Add learner course playback: lesson view, next/previous navigation, resume position, and activity completion.
4. Add native quiz attempts and automatic marking.
5. Add assignment/project submissions and teacher grading.
6. Add discussion activities.
7. Connect certificates to native course/module/activity completion.
8. Add browser-based HTML/CSS/JavaScript coding activities.
9. Add Python code submission first, then optional isolated execution later.
10. Add advanced analytics after the native learning workflow is stable.

## Lightweight Hosting Target

Keep the main app simple enough for:

- Vercel or another lightweight frontend host.
- Supabase PostgreSQL or a small managed PostgreSQL database.
- Supabase Storage or equivalent object storage for school files and submissions.
- A lightweight Node API, or a later migration to Next.js API routes if desired.

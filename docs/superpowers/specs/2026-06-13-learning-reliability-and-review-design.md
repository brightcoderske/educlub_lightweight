# Learning Reliability and Review Design

## Goal

Improve session reliability, learner navigation, teacher review, course authoring, preview, registration, and page responsiveness without adding resource-heavy background services or duplicate data stores.

## Design Principles

- Reuse existing course, progress, submission, quiz-attempt, term, and allocation records.
- Perform work in response to user actions; do not add polling except the existing live discussion refresh.
- Update frontend state locally after successful mutations instead of reloading full pages.
- Keep authorization, score limits, progressive-learning locks, and school scope enforced by the backend.
- Add database indexes only for query paths used by these features.

## 1. Session and Authentication

The frontend will decode the JWT expiry locally. While a signed-in user is actively interacting with the application, it will request a refreshed JWT only when the current token is close to expiry. Refresh requests are throttled and activity-driven, so there is no background heartbeat.

The backend will expose an authenticated refresh endpoint that returns a new JWT only for an active user. It will not create a refresh-token table in this phase.

All API responses with HTTP 401 or an expired-token HTTP 403 will trigger one centralized authentication-expired event. The authentication context will clear stored credentials and redirect to sign-in immediately. Ordinary permission-denied 403 responses will remain visible errors and will not log the user out.

The fixed idle timeout will no longer sign out a learner who is actively reading, typing, scrolling, answering, running code, or navigating. Genuine inactivity may still produce the existing warning and logout.

## 2. Learner Navigation and Continue Learning

Course overview activity rows will become full clickable cards. Locked cards remain visible but disabled and display their progressive-learning or availability reason.

The module learning page will:

- Accept an activity identifier in the URL query string.
- Open that activity when it is available.
- Show Previous Activity and Next Activity controls.
- Scroll the learning content to the top whenever the active activity changes.
- Preserve progressive-learning rules by refusing locked activities.
- Place a compact activity navigator above the learning content so learners do not need to scroll through the module.

Continue Learning will be derived from existing activity progress:

1. Prefer the most recently updated incomplete activity.
2. Otherwise choose the first unlocked incomplete activity in the learner's active courses.
3. Otherwise open the first incomplete module or the course overview.

The learner dashboard will show one Continue Learning action when a destination exists. No separate resume table will be introduced.

## 3. Teacher Review and Grading

The existing course activity review will remain the primary review surface. It will display:

- Text, code, generated output, uploaded files, and project links from activity submissions.
- Quiz answers beside each question.
- The activity maximum marks beside the teacher score input.
- A numeric input capped at the activity maximum.

The backend will reject grades below zero or above the activity maximum. Existing grades and learner progress remain attached to the same learner and activity records.

Weekly quiz review will expose each learner attempt, question response, automatic score, and typed/open answer. It will use existing weekly quiz attempt and answer data and remain scoped to the teacher's assigned school courses.

Short-answer questions will store acceptable answers as an array. Auto-marking will normalize case, surrounding whitespace, and repeated internal whitespace before comparing answers. Existing single-string answers remain compatible by being treated as a one-item array.

## 4. Rich Text Hints

The rich text editor will support a hint block inserted at the current cursor position. The block will use semantic HTML and existing rich content storage, with no new table or dependency.

In learner view, hint blocks render as compact reveal controls. Their content remains hidden until the learner selects the hint. Teachers see and edit the full hint inside the course builder.

## 5. Preview as Learner

School administrators and assigned teachers will receive a Preview as Learner action from the school course builder.

Preview mode will reuse the learner course overview and module-learning presentation while disabling:

- Progress writes
- Quiz submissions
- Discussion posts
- Assignment uploads
- Grades, badges, and completion changes

Preview respects publication, scheduling, and progressive ordering so teachers can inspect the learner flow without creating learner records or modifying progress.

## 6. Self-Registration and Terms

Public registration will load available terms with labels containing academic year and term name.

If the learner does not choose a term, the backend will assign the active term automatically. A supplied term must be valid and open for registration. Registration will validate all required fields on both frontend and backend.

Successful registration will create or link the learner account, associate the selected or active term, preserve school scope, send the existing welcome/activation email, and return a clear next destination. The Register button will enable only when required fields and consent are complete.

## 7. Performance

Performance work will remain targeted:

- Batch independent dashboard requests with `Promise.all`.
- Avoid full builder/module reloads after successful local mutations.
- Fetch detailed activity content only when needed where existing APIs permit it.
- Prevent duplicate requests during rapid navigation.
- Lazy-load large preview/editor surfaces where practical within the existing React application.
- Add indexes for resume lookup, weekly attempt review, and submission review only when the query does not already have a suitable index.
- Keep media URLs and uploaded assets external to API response bodies after upload.

## Error Handling

- Save and submission forms retain user-entered content when requests fail.
- Locked activities state why they cannot open.
- Expired authentication redirects immediately and preserves the intended URL for post-login return.
- Validation errors identify the exact invalid question, score, term, or registration field.
- Preview mode clearly indicates that actions are read-only.

## Testing

- Backend unit tests cover refresh authorization, grade caps, acceptable short answers, registration term selection, preview write protection, and school scope.
- Frontend tests cover centralized expiry handling, resume destination selection, activity navigation, scroll-to-top, grade input limits, hint blocks, and registration readiness.
- Existing backend and frontend suites must pass.
- Production frontend build must compile without lint or Prettier errors.
- Browser verification will cover learner resume/navigation, teacher review, preview mode, and registration at desktop and mobile widths.

## Delivery Order

1. Session reliability and low-cost request/performance improvements.
2. Learner activity navigation and Continue Learning.
3. Teacher grading/review, typed answers, rich hints, preview, and registration.

Each batch will be independently tested and committed before the final push.

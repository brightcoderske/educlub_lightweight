#!/usr/bin/env node
/**
 * Awards the course certificates learners have already earned.
 *
 * A certificate is created at the moment a learner finishes a course's last
 * required activity, and only when the course awards one. Courses used to be
 * made with certificates switched off, with no screen to switch them on, so
 * learners who finished got nothing; switching it on now does not reach them,
 * because their last activity is already done. This catches them up.
 *
 *   node scripts/course-certificates.js            list what would change; change nothing
 *   node scripts/course-certificates.js --apply    switch certificates on and create them
 *
 * Weekly typing and quiz courses are left alone: they never award one.
 * Certificates are created as pending, for a school admin to approve on the
 * Certificates page, exactly like one created the moment a course is finished.
 * Running it again changes nothing that is already done.
 */
require("../src/config/loadEnv").loadEnv();
const { query, pool } = require("../src/config/db");
const {
  courseCompletionSummary,
  maybeCreateCourseCompletionCertificate,
} = require("../src/services/courses.service");

const REGULAR_COURSE = "COALESCE(c.course_category, 'general') NOT IN ('weekly_typing', 'weekly_quiz')";

async function main() {
  const apply = process.argv.includes("--apply");

  const switchedOff = await query(
    `SELECT c.id, c.name FROM courses c
     WHERE ${REGULAR_COURSE} AND c.deleted_at IS NULL AND NOT COALESCE(c.certificate_enabled, false)
     ORDER BY c.id`,
  );
  console.log(`Courses with certificates switched off: ${switchedOff.rows.length}`);
  switchedOff.rows.forEach((course) => console.log(`  ${course.id}  ${course.name}`));
  if (apply && switchedOff.rows.length) {
    await query(
      `UPDATE courses c SET certificate_enabled = true, updated_at = CURRENT_TIMESTAMP
       WHERE ${REGULAR_COURSE} AND c.deleted_at IS NULL AND NOT COALESCE(c.certificate_enabled, false)`,
    );
    console.log("  -> switched on");
  }

  const allocations = await query(
    `SELECT a.learner_id, a.course_id, a.term, a.academic_year, l.full_name, c.name AS course_name
     FROM course_allocations a
     JOIN learners l ON l.id = a.learner_id
     JOIN courses c ON c.id = a.course_id
     WHERE a.status IN ('active', 'in_progress', 'completed')
       AND ${REGULAR_COURSE} AND c.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM certificates ce
         WHERE ce.learner_id = a.learner_id AND ce.course_id = a.course_id
       )
     ORDER BY c.id, l.full_name`,
  );

  const earned = [];
  for (const allocation of allocations.rows) {
    const summary = await courseCompletionSummary(allocation.course_id, allocation.learner_id);
    if (summary?.finished) earned.push(allocation);
  }

  console.log(`\nLearners who finished a course but have no certificate: ${earned.length}`);
  for (const allocation of earned) {
    console.log(`  ${allocation.full_name}  -  ${allocation.course_name}`);
    if (apply) {
      await maybeCreateCourseCompletionCertificate({
        learnerId: allocation.learner_id,
        courseId: allocation.course_id,
        term: allocation.term,
        academicYear: allocation.academic_year,
      });
    }
  }

  if (!apply) {
    console.log("\nNothing changed. Run again with --apply to make these changes.");
  } else if (earned.length) {
    console.log(
      `\nCreated ${earned.length} certificate(s), waiting for approval under School Admin > Certificates.`,
    );
  } else {
    console.log("\nNothing to do.");
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end?.());

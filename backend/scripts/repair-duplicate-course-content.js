#!/usr/bin/env node
/**
 * Removes the duplicate modules and activities a template sync used to create.
 *
 * Before the sync fix, a school course whose modules carried no
 * template_module_id had the whole template inserted alongside what was already
 * there, every time the button was pressed. This finds those copies and deletes
 * them - but never one a learner has touched.
 *
 * Every dependent table cascades from course_modules and learning_activities,
 * so deleting the wrong row would silently take grades, submissions, progress,
 * quiz attempts and badges with it. A copy with any learner evidence against it
 * is kept and reported instead, even when it is clearly the duplicate.
 *
 * Changes nothing unless --apply is given:
 *
 *   node scripts/repair-duplicate-course-content.js
 *   node scripts/repair-duplicate-course-content.js --apply
 *   node scripts/repair-duplicate-course-content.js --course 4 --apply
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { query, pool } = require("../src/config/db");
const { normalizeTitle } = require("../src/services/courseSync");

const APPLY = process.argv.includes("--apply");
const courseArg = process.argv.indexOf("--course");
const ONLY_COURSE = courseArg === -1 ? null : Number(process.argv[courseArg + 1]);

// Tables holding something a learner did. quiz_questions is deliberately
// absent: those belong to the activity itself, not to a learner.
const ACTIVITY_EVIDENCE = [
  ["activity_grades", "activity_id"],
  ["activity_progress", "activity_id"],
  ["activity_submissions", "activity_id"],
  ["discussions", "activity_id"],
  ["quiz_attempts", "activity_id"],
  ["learning_availability_overrides", "activity_id"],
];

const MODULE_EVIDENCE = [
  ["learner_module_badges", "module_id"],
  ["module_feedback", "module_id"],
  ["school_module_schedules", "module_id"],
  ["learning_availability_overrides", "module_id"],
];

async function countEvidence(tables, id) {
  let total = 0;
  for (const [table, column] of tables) {
    const result = await query(
      `SELECT COUNT(*) AS hits FROM ${table} WHERE ${column} = $1`,
      [id],
    );
    total += Number(result.rows[0].hits || 0);
  }
  return total;
}

async function moduleEvidence(moduleId) {
  const own = await countEvidence(MODULE_EVIDENCE, moduleId);
  const activities = await query(
    "SELECT id FROM learning_activities WHERE module_id = $1",
    [moduleId],
  );
  let inherited = 0;
  for (const activity of activities.rows) {
    inherited += await countEvidence(ACTIVITY_EVIDENCE, activity.id);
  }
  return { total: own + inherited, activities: activities.rows.length };
}

/**
 * Rows that are the same thing.
 *
 * Two rows belong together if they share a template link OR a title, and the
 * relation is transitive - which matters here, because the copies a bad sync
 * inserted carry the template link while the originals they duplicate carry
 * only the title. Keying on one or the other alone would put the two halves of
 * the same duplicate in different groups and find nothing.
 */
function duplicateGroups(rows, linkColumn) {
  const groups = [];
  const keyOf = (row) => [
    row[linkColumn] ? `link:${row[linkColumn]}` : null,
    `title:${normalizeTitle(row.title)}`,
  ].filter(Boolean);

  for (const row of rows) {
    const keys = keyOf(row);
    const matches = groups.filter((group) =>
      group.keys.some((key) => keys.includes(key)),
    );

    if (!matches.length) {
      groups.push({ keys: [...keys], rows: [row] });
      continue;
    }

    // Joining two existing groups is normal: a row can be the first to show
    // that a link and a title describe the same module.
    const [first, ...rest] = matches;
    first.rows.push(row);
    first.keys = [...new Set([...first.keys, ...keys])];
    for (const other of rest) {
      first.rows.push(...other.rows);
      first.keys = [...new Set([...first.keys, ...other.keys])];
      groups.splice(groups.indexOf(other), 1);
    }
  }

  return groups.map((group) => group.rows).filter((rows) => rows.length > 1);
}

/**
 * Which copy survives: the one a learner has worked in, then the one linked to
 * the template, then the oldest.
 */
function chooseKeeper(group) {
  return [...group].sort((left, right) => {
    if (left.evidence !== right.evidence) return right.evidence - left.evidence;
    const leftLinked = left.linked ? 1 : 0;
    const rightLinked = right.linked ? 1 : 0;
    if (leftLinked !== rightLinked) return rightLinked - leftLinked;
    return left.id - right.id;
  })[0];
}

async function repairCourse(course) {
  const modules = await query(
    "SELECT * FROM course_modules WHERE course_id = $1 ORDER BY position, id",
    [course.id],
  );

  const decorated = [];
  for (const row of modules.rows) {
    const evidence = await moduleEvidence(row.id);
    decorated.push({
      id: row.id,
      title: row.title,
      template_module_id: row.template_module_id,
      linked: Boolean(row.template_module_id),
      evidence: evidence.total,
      activities: evidence.activities,
    });
  }

  const moduleActions = { deleted: [], blocked: [] };
  for (const group of duplicateGroups(decorated, "template_module_id")) {
    const keeper = chooseKeeper(group);
    for (const row of group) {
      if (row.id === keeper.id) continue;
      if (row.evidence > 0) moduleActions.blocked.push(row);
      else moduleActions.deleted.push(row);
    }
  }

  // Only look inside the modules that survive; the rest are going anyway.
  const surviving = decorated
    .filter((row) => !moduleActions.deleted.some((victim) => victim.id === row.id))
    .map((row) => row.id);

  const activityActions = { deleted: [], blocked: [] };
  for (const moduleId of surviving) {
    const activities = await query(
      "SELECT * FROM learning_activities WHERE module_id = $1 ORDER BY position, id",
      [moduleId],
    );
    const rows = [];
    for (const activity of activities.rows) {
      rows.push({
        id: activity.id,
        title: activity.title,
        module_id: moduleId,
        template_activity_id: activity.template_activity_id,
        linked: Boolean(activity.template_activity_id),
        evidence: await countEvidence(ACTIVITY_EVIDENCE, activity.id),
      });
    }
    for (const group of duplicateGroups(rows, "template_activity_id")) {
      const keeper = chooseKeeper(group);
      for (const row of group) {
        if (row.id === keeper.id) continue;
        if (row.evidence > 0) activityActions.blocked.push(row);
        else activityActions.deleted.push(row);
      }
    }
  }

  return { moduleActions, activityActions };
}

async function main() {
  const courses = await query(
    `SELECT id, name, school_id
     FROM courses
     WHERE deleted_at IS NULL
       AND ($1 IS NULL OR id = $1)
     ORDER BY id`,
    [ONLY_COURSE],
  );

  let deletedModules = 0;
  let deletedActivities = 0;
  let blocked = 0;

  for (const course of courses.rows) {
    const { moduleActions, activityActions } = await repairCourse(course);
    const touched =
      moduleActions.deleted.length +
      moduleActions.blocked.length +
      activityActions.deleted.length +
      activityActions.blocked.length;
    if (!touched) continue;

    console.log(`\ncourse ${course.id}: ${course.name} (school ${course.school_id})`);

    for (const row of moduleActions.deleted) {
      console.log(
        `  ${APPLY ? "deleted" : "would delete"} module ${row.id} "${row.title}" - ${row.activities} activities, no learner data`,
      );
      if (APPLY) await query("DELETE FROM course_modules WHERE id = $1", [row.id]);
      deletedModules += 1;
    }
    for (const row of moduleActions.blocked) {
      console.log(
        `  KEPT module ${row.id} "${row.title}" - a duplicate, but ${row.evidence} learner records point at it`,
      );
      blocked += 1;
    }
    for (const row of activityActions.deleted) {
      console.log(
        `  ${APPLY ? "deleted" : "would delete"} activity ${row.id} "${row.title}" in module ${row.module_id}`,
      );
      if (APPLY) await query("DELETE FROM learning_activities WHERE id = $1", [row.id]);
      deletedActivities += 1;
    }
    for (const row of activityActions.blocked) {
      console.log(
        `  KEPT activity ${row.id} "${row.title}" - a duplicate, but ${row.evidence} learner records point at it`,
      );
      blocked += 1;
    }
  }

  console.log(
    `\n${APPLY ? "deleted" : "would delete"}: ${deletedModules} modules, ${deletedActivities} activities`,
  );
  if (blocked) {
    console.log(`kept despite being duplicates, because learners have worked in them: ${blocked}`);
    console.log("Move that work onto the surviving copy before removing them by hand.");
  }
  if (!APPLY) console.log("\nNothing was changed. Re-run with --apply to delete.");
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error.message);
    await pool.end();
    process.exit(1);
  });

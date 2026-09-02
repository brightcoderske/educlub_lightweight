const { query } = require("../config");

const closedAllocationPeriodSql = `EXISTS (
  SELECT 1 FROM terms history_term
  JOIN academic_years history_year ON history_year.id = history_term.academic_year_id
  WHERE history_term.name = a.term AND history_year.year = a.academic_year
    AND history_term.end_date < CURRENT_DATE
)`;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value))));
}

function gradeLabel(score) {
  const value = Number(score || 0);
  if (value >= 80) return "Exceeding Expectations";
  if (value >= 50) return "Meeting Expectations";
  return "Approaching Expectations";
}

async function cacheProgress(learnerId, courseId, term, academicYear, progressData) {
  await query(
    `INSERT INTO progress_cache (learner_id, course_id, term, academic_year, progress_data, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (learner_id, course_id, term, academic_year)
     DO UPDATE SET progress_data = EXCLUDED.progress_data, last_synced_at = NOW()`,
    [learnerId, courseId, term, Number(academicYear), JSON.stringify(progressData)]
  );
}

// Same upsert as cacheProgress, but for a whole cohort in one statement so a
// school-wide read does not cost one write round trip per learner.
async function cacheProgressBatch(entries) {
  if (!entries.length) return;

  const columns = 5;
  const rows = entries
    .map((entry, index) => {
      const base = index * columns;
      const slots = Array.from({ length: columns }, (_, offset) => `$${base + offset + 1}`);
      return `(${slots.join(", ")}, NOW())`;
    })
    .join(", ");

  await query(
    `INSERT INTO progress_cache (learner_id, course_id, term, academic_year, progress_data, last_synced_at)
     VALUES ${rows}
     ON CONFLICT (learner_id, course_id, term, academic_year)
     DO UPDATE SET progress_data = EXCLUDED.progress_data, last_synced_at = NOW()`,
    entries.flatMap((entry) => [
      entry.learnerId,
      entry.courseId,
      entry.term,
      Number(entry.academicYear),
      JSON.stringify(entry.progressData),
    ])
  );
}

async function getCachedCourseProgressForPeriod(learnerId, term, academicYear) {
  const result = await query(
    `SELECT pc.progress_data
     FROM progress_cache pc
     JOIN course_allocations a
       ON a.learner_id = pc.learner_id
      AND a.course_id = pc.course_id
      AND a.term = pc.term
      AND a.academic_year = pc.academic_year
     JOIN courses c ON c.id = pc.course_id
     WHERE pc.learner_id = $1
       AND pc.term = $2
       AND pc.academic_year = $3
       AND a.status IN ('active', 'in_progress', 'completed')
       AND COALESCE(c.course_category, 'general') = 'general'
     ORDER BY a.allocated_at DESC`,
    [learnerId, term, Number(academicYear)]
  );

  return result.rows.map((row) => row.progress_data);
}

async function getActiveAllocations(learnerId, term = null, academicYear = null) {
  const result = await query(
    `SELECT a.id AS allocation_id,
            a.term,
            a.academic_year,
            ${closedAllocationPeriodSql} AS is_closed_period,
            c.id,
            c.name
     FROM course_allocations a
     JOIN courses c ON c.id = a.course_id
     WHERE a.learner_id = $1
       AND a.status IN ('active', 'in_progress', 'completed')
       AND COALESCE(c.course_category, 'general') = 'general'
       AND ($2::varchar IS NULL OR a.term = $2::varchar)
       AND ($3::integer IS NULL OR a.academic_year = $3::integer)
     ORDER BY a.allocated_at DESC`,
    [learnerId, term, academicYear ? Number(academicYear) : null]
  );
  return result.rows;
}

async function buildNativeCourseProgress(learnerId, course) {
  const result = await query(
    `SELECT
       cm.id AS module_id,
       cm.title AS module_title,
       cm.position AS module_position,
       la.id AS activity_id,
       la.title AS activity_title,
       la.activity_type,
       la.position AS activity_position,
       COALESCE(la.availability_mode, 'required') AS availability_mode,
       COALESCE(ap.status, 'not_started') AS progress_status,
       ap.score
     FROM course_modules cm
     LEFT JOIN learning_activities la
       ON la.module_id = cm.id
      AND la.is_published = true
     LEFT JOIN activity_progress ap
       ON ap.activity_id = la.id
      AND ap.learner_id = $1
     WHERE cm.course_id = $2
       AND cm.is_published = true
     ORDER BY cm.position, la.position`,
    [learnerId, course.id]
  );

  return assembleCourseProgress(course, result.rows);
}

// Fetches the same activity rows for many learners in one round trip. Only the
// fetch differs from buildNativeCourseProgress; the maths is the shared
// assembleCourseProgress below, so both paths always report identical numbers.
async function buildNativeCourseProgressForLearners(learnerIds, course) {
  const progressByLearner = new Map();
  if (!learnerIds.length) return progressByLearner;

  const result = await query(
    `SELECT
       target.learner_id,
       cm.id AS module_id,
       cm.title AS module_title,
       cm.position AS module_position,
       la.id AS activity_id,
       la.title AS activity_title,
       la.activity_type,
       la.position AS activity_position,
       COALESCE(la.availability_mode, 'required') AS availability_mode,
       COALESCE(ap.status, 'not_started') AS progress_status,
       ap.score
     FROM (SELECT id AS learner_id FROM learners WHERE id = ANY($1)) AS target
     CROSS JOIN course_modules cm
     LEFT JOIN learning_activities la
       ON la.module_id = cm.id
      AND la.is_published = true
     LEFT JOIN activity_progress ap
       ON ap.activity_id = la.id
      AND ap.learner_id = target.learner_id
     WHERE cm.course_id = $2
       AND cm.is_published = true
     ORDER BY target.learner_id, cm.position, la.position`,
    [learnerIds, course.id]
  );

  const rowsByLearner = new Map();
  result.rows.forEach((row) => {
    const key = Number(row.learner_id);
    if (!rowsByLearner.has(key)) rowsByLearner.set(key, []);
    rowsByLearner.get(key).push(row);
  });

  learnerIds.forEach((learnerId) => {
    const key = Number(learnerId);
    progressByLearner.set(key, assembleCourseProgress(course, rowsByLearner.get(key) || []));
  });

  return progressByLearner;
}

function assembleCourseProgress(course, rows) {
  const moduleMap = new Map();
  rows.forEach((row) => {
    if (!moduleMap.has(row.module_id)) {
      moduleMap.set(row.module_id, {
        module_number: row.module_position,
        name: row.module_title,
        activities: [],
      });
    }

    if (row.activity_id) {
      moduleMap.get(row.module_id).activities.push({
        id: row.activity_id,
        name: row.activity_title,
        type: row.activity_type,
        availability_mode: row.availability_mode,
        completed: ["completed", "graded"].includes(row.progress_status),
        score_percent: row.score === null ? null : clampPercent(row.score),
      });
    }
  });

  const modules = [...moduleMap.values()].map((module) => {
    const requiredActivities = module.activities.filter(
      (activity) => activity.availability_mode !== "try_more"
    );
    const optionalActivities = module.activities.filter(
      (activity) => activity.availability_mode === "try_more"
    );
    const totalActivities = requiredActivities.length;
    const completedActivities = requiredActivities.filter(
      (activity) => activity.completed
    ).length;
    const scoredActivities = requiredActivities.filter(
      (activity) => activity.score_percent !== null
    );
    const score =
      scoredActivities.length > 0
        ? scoredActivities.reduce((sum, activity) => sum + activity.score_percent, 0) /
          scoredActivities.length
        : totalActivities > 0
        ? (completedActivities / totalActivities) * 100
        : 0;

    return {
      ...module,
      total_activities: totalActivities,
      completed_activities: completedActivities,
      progress_percent:
        totalActivities > 0 ? clampPercent((completedActivities / totalActivities) * 100) : 0,
      score_percent: clampPercent(score),
      grade_label: gradeLabel(score),
      try_more_total: optionalActivities.length,
      try_more_completed: optionalActivities.filter((activity) => activity.completed).length,
    };
  });

  const totalActivities = modules.reduce((sum, module) => sum + module.total_activities, 0);
  const completedActivities = modules.reduce(
    (sum, module) => sum + module.completed_activities,
    0
  );
  const completedModules = modules.filter(
    (module) => module.total_activities > 0 && module.completed_activities >= module.total_activities
  ).length;
  const score =
    modules.length > 0
      ? modules.reduce((sum, module) => sum + module.score_percent, 0) / modules.length
      : 0;

  return {
    course_id: course.id,
    course_name: course.name,
    completion_percent:
      totalActivities > 0 ? clampPercent((completedActivities / totalActivities) * 100) : 0,
    score_percent: clampPercent(score),
    grade_label: gradeLabel(score),
    completed_modules: completedModules,
    total_modules: modules.length,
    active_module:
      modules.find((module) => module.completed_activities < module.total_activities) ||
      modules[0] ||
      null,
    modules,
  };
}

async function updateWeeklyActiveCourse(learnerId, term, academicYear, progressData) {
  const weekResult = await query(
    `SELECT week_number
     FROM weekly_marks
     WHERE learner_id = $1 AND term = $2 AND academic_year = $3
     ORDER BY week_number DESC
     LIMIT 1`,
    [learnerId, term, Number(academicYear)]
  );

  const weekNumber = weekResult.rows[0]?.week_number || 1;
  await query(
    `INSERT INTO weekly_marks (
       learner_id,
       week_number,
       term,
       academic_year,
       active_course_score,
       active_course_modules_completed,
       active_course_modules_total
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (learner_id, week_number, term, academic_year)
     DO UPDATE SET
       active_course_score = EXCLUDED.active_course_score,
       active_course_modules_completed = EXCLUDED.active_course_modules_completed,
       active_course_modules_total = EXCLUDED.active_course_modules_total,
       updated_at = NOW()`,
    [
      learnerId,
      weekNumber,
      term,
      Number(academicYear),
      progressData.score_percent,
      progressData.completed_modules,
      progressData.total_modules,
    ]
  );
}

async function getLearnerCourseProgress(learnerId, term, academicYear, options = {}) {
  const learnerResult = await query("SELECT * FROM learners WHERE id = $1", [learnerId]);
  const learner = learnerResult.rows[0];
  if (!learner) throw new Error("Learner not found");

  const requestedTerm = term || null;
  const requestedAcademicYear = academicYear ? Number(academicYear) : null;

  if (options.cachedOnly) {
    return getCachedCourseProgressForPeriod(learnerId, requestedTerm, requestedAcademicYear);
  }

  const allocations = await getActiveAllocations(
    learnerId,
    requestedTerm,
    requestedAcademicYear
  );
  const progress = [];
  const historyByPeriod = new Map();

  for (const course of allocations) {
    const effectiveTerm = term || course.term || "Term 1";
    const effectiveAcademicYear = Number(
      academicYear || course.academic_year || new Date().getFullYear()
    );
    if (course.is_closed_period) {
      const periodKey = JSON.stringify([effectiveTerm, effectiveAcademicYear]);
      if (!historyByPeriod.has(periodKey)) {
        historyByPeriod.set(periodKey, await getCachedCourseProgressForPeriod(learnerId, effectiveTerm, effectiveAcademicYear));
      }
      const saved = historyByPeriod.get(periodKey);
      const snapshot = saved.find((item) => Number(item.course_id) === Number(course.id));
      if (snapshot) progress.push(snapshot);
      continue;
    }
    const progressData = await buildNativeCourseProgress(learnerId, course);

    await cacheProgress(learnerId, course.id, effectiveTerm, effectiveAcademicYear, progressData);
    if (options.updateWeekly !== false) {
      await updateWeeklyActiveCourse(learnerId, effectiveTerm, effectiveAcademicYear, progressData);
    }
    progress.push(progressData);
  }

  return progress;
}

function matchesPerformance(score, performance) {
  if (!performance) return true;
  const value = Number(score || 0);
  if (performance === "approaching") return value <= 50;
  if (performance === "meets") return value > 50 && value <= 80;
  if (performance === "exceeding") return value > 80;
  return true;
}

async function getSchoolCourseProgress({
  schoolId,
  courseId,
  term,
  academicYear,
  grade,
  stream,
  moduleNumber,
  performance,
}) {
  const params = [schoolId, courseId];
  let paramIndex = 3;
  let filters = "";

  if (grade) {
    filters += ` AND l.grade = $${paramIndex}`;
    params.push(grade);
    paramIndex += 1;
  }

  if (stream) {
    filters += ` AND l.stream = $${paramIndex}`;
    params.push(stream);
  }

  // Resolve the cohort and its allocation period in one statement. The term,
  // year and category filters mirror getActiveAllocations so this path selects
  // exactly the learners the per-learner path used to return.
  // Derive from params.length: the stream filter above reuses paramIndex
  // without incrementing it, so paramIndex is not a reliable next-slot marker.
  const termParam = `$${params.length + 1}`;
  const yearParam = `$${params.length + 2}`;
  params.push(term || null, academicYear ? Number(academicYear) : null);

  const learnersResult = await query(
    // DISTINCT ON (l.id) ... ORDER BY l.id, a.allocated_at DESC keeps the most
    // recent allocation per learner. MySQL has no DISTINCT ON, so the same rule
    // is expressed as a numbered window filtered to the first row.
    `SELECT id, full_name, grade, stream, email,
            allocation_term, allocation_academic_year, course_name, is_closed_period, cached_progress
     FROM (
       SELECT l.id, l.full_name, l.grade, l.stream, l.email,
              a.term AS allocation_term,
              a.academic_year AS allocation_academic_year,
              c.name AS course_name,
              ${closedAllocationPeriodSql} AS is_closed_period,
              pc.progress_data AS cached_progress,
              ROW_NUMBER() OVER (
                PARTITION BY l.id ORDER BY a.allocated_at DESC
              ) AS recency
       FROM learners l
       JOIN course_allocations a ON a.learner_id = l.id
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN progress_cache pc ON pc.learner_id = a.learner_id AND pc.course_id = a.course_id
         AND pc.term = a.term AND pc.academic_year = a.academic_year
       WHERE l.school_id = $1
         AND a.course_id = $2
         AND a.status IN ('active', 'in_progress', 'completed')
         AND COALESCE(c.course_category, 'general') = 'general'
         AND (${termParam}::varchar IS NULL OR a.term = ${termParam}::varchar)
         AND (${yearParam}::integer IS NULL OR a.academic_year = ${yearParam}::integer)
         ${filters}
     ) ranked
     WHERE recency = 1`,
    params
  );

  const learners = learnersResult.rows.sort(
    (left, right) =>
      String(left.grade || "").localeCompare(String(right.grade || "")) ||
      String(left.stream || "").localeCompare(String(right.stream || "")) ||
      String(left.full_name || "").localeCompare(String(right.full_name || ""))
  );

  const course = { id: Number(courseId), name: learners[0]?.course_name };
  const currentLearners = learners.filter((learner) => !learner.is_closed_period);
  const progressByLearner = await buildNativeCourseProgressForLearners(
    currentLearners.map((learner) => learner.id),
    course
  );

  await cacheProgressBatch(
    currentLearners.map((learner) => ({
      learnerId: learner.id,
      courseId: course.id,
      term: term || learner.allocation_term || "Term 1",
      academicYear: Number(
        academicYear || learner.allocation_academic_year || new Date().getFullYear()
      ),
      progressData: progressByLearner.get(Number(learner.id)),
    }))
  );

  const rows = [];
  for (const learner of learners) {
    const progress = learner.is_closed_period
      ? learner.cached_progress
      : progressByLearner.get(Number(learner.id));
    if (!progress) continue;

    const selectedModule =
      moduleNumber && moduleNumber !== "all"
        ? progress.modules.find((item) => Number(item.module_number) === Number(moduleNumber))
        : progress.active_module || progress.modules[0] || null;
    const selectedScore = selectedModule?.score_percent ?? progress.score_percent;
    if (!matchesPerformance(selectedScore, performance)) continue;

    rows.push({
      learner_id: learner.id,
      full_name: learner.full_name,
      grade: learner.grade,
      stream: learner.stream,
      course_id: progress.course_id,
      course_name: progress.course_name,
      completion_percent: progress.completion_percent,
      score_percent: progress.score_percent,
      grade_label: progress.grade_label,
      completed_modules: progress.completed_modules,
      total_modules: progress.total_modules,
      selected_module: selectedModule,
      modules: progress.modules,
    });
  }

  return rows;
}

async function getSchoolCompletionSummary({ schoolId, term, academicYear }) {
  const params = [schoolId];
  let filters = "";

  if (term) {
    params.push(term);
    filters += ` AND COALESCE(pc.term, a.term) = $${params.length}`;
  }

  if (academicYear) {
    params.push(Number(academicYear));
    filters += ` AND COALESCE(pc.academic_year, a.academic_year) = $${params.length}`;
  }

  const result = await query(
    `SELECT
       COUNT(*)::int AS allocations,
       COUNT(pc.id)::int AS synced_allocations,
       COUNT(*) FILTER (WHERE a.status = 'completed')::int AS completed_allocations,
       ROUND(AVG(
         COALESCE(
           NULLIF(pc.progress_data->>'completion_percent', '')::numeric,
           CASE
             WHEN a.status = 'completed' THEN 100
             WHEN a.status = 'in_progress' THEN 50
             ELSE 0
           END
         )
       ))::int AS completion_rate
     FROM course_allocations a
     JOIN learners l ON l.id = a.learner_id
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN progress_cache pc
       ON pc.learner_id = a.learner_id
      AND pc.course_id = a.course_id
      AND pc.term = a.term
      AND pc.academic_year = a.academic_year
     WHERE l.school_id = $1
       AND a.status IN ('active', 'in_progress', 'completed')
       AND COALESCE(c.course_category, 'general') = 'general'
       ${filters}`,
    params
  );

  return {
    allocations: result.rows[0]?.allocations || 0,
    synced_allocations: result.rows[0]?.synced_allocations || 0,
    completed_allocations: result.rows[0]?.completed_allocations || 0,
    completion_rate: result.rows[0]?.completion_rate || 0,
  };
}

module.exports = {
  getLearnerCourseProgress,
  getSchoolCourseProgress,
  getSchoolCompletionSummary,
  getCachedCourseProgressForPeriod,
  gradeLabel,
};

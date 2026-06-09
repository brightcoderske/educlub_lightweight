const { query } = require("../config");

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

async function getCachedProgressForCourse(learnerId, courseId, term, academicYear) {
  const cached = await query(
    `SELECT progress_data
     FROM progress_cache
     WHERE learner_id = $1 AND course_id = $2 AND term = $3 AND academic_year = $4
     LIMIT 1`,
    [learnerId, courseId, term, Number(academicYear)]
  );
  return cached.rows[0]?.progress_data || null;
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

async function getActiveAllocations(learnerId) {
  const result = await query(
    `SELECT a.id AS allocation_id,
            a.term,
            a.academic_year,
            c.id,
            c.name
     FROM course_allocations a
     JOIN courses c ON c.id = a.course_id
     WHERE a.learner_id = $1
       AND a.status IN ('active', 'in_progress', 'completed')
       AND COALESCE(c.course_category, 'general') = 'general'
     ORDER BY a.allocated_at DESC`,
    [learnerId]
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

  const moduleMap = new Map();
  result.rows.forEach((row) => {
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
        completed: ["completed", "graded"].includes(row.progress_status),
        score_percent: row.score === null ? null : clampPercent(row.score),
      });
    }
  });

  const modules = [...moduleMap.values()].map((module) => {
    const totalActivities = module.activities.length;
    const completedActivities = module.activities.filter((activity) => activity.completed).length;
    const scoredActivities = module.activities.filter((activity) => activity.score_percent !== null);
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

  const allocations = await getActiveAllocations(learnerId);
  const progress = [];

  for (const course of allocations) {
    const effectiveTerm = term || course.term || "Term 1";
    const effectiveAcademicYear = Number(
      academicYear || course.academic_year || new Date().getFullYear()
    );
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

  const learnersResult = await query(
    `SELECT DISTINCT l.id, l.full_name, l.grade, l.stream, l.email
     FROM learners l
     JOIN course_allocations a ON a.learner_id = l.id
     WHERE l.school_id = $1
       AND a.course_id = $2
       AND a.status IN ('active', 'in_progress', 'completed')
       ${filters}
     ORDER BY l.grade, l.stream, l.full_name`,
    params
  );

  const rows = [];
  for (const learner of learnersResult.rows) {
    const progressItems = await getLearnerCourseProgress(learner.id, term, academicYear, {
      updateWeekly: false,
    });
    const progress = progressItems.find((item) => Number(item.course_id) === Number(courseId));
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

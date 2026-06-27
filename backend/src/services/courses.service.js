const { query } = require("../config");
const crypto = require("crypto");
const env = require("../config/env");
const { masteryUpdateSql } = require("./progressMastery");
const courseTemplatesService = require("./courseTemplates.service");
const flutterwave = require("./flutterwave.service");
const independentLearnersService = require("./independentLearners.service");
const {
  resolveModuleAvailability,
  annotateActivityAvailability,
} = require("./activityAvailability.service");
const {
  recalculateModuleBadge,
  listLearnerBadges,
} = require("./moduleBadges.service");
const {
  normalizeBooleanAnswer,
  validateCodingChallenge,
  evaluateSourceChecks,
} = require("./codingChallenges.service");
const moduleFeedbackService = require("./moduleFeedback.service");
const teacherAssignmentsService = require("./teacherAssignments.service");
const certificatesService = require("./certificates.service");
const { normalizeActivityGrade } = require("./gradingPolicy");
const {
  sanitizeActivityContent: sanitizeActivityContentForStorage,
} = require("../utils/richTextSanitizer");

function normalizeCourseCategory(category) {
  if (["general", "weekly_typing", "weekly_quiz"].includes(category)) {
    return category;
  }
  return "general";
}

async function getAllCourses(filters = {}) {
  const category =
    filters.category === "all"
      ? null
      : normalizeCourseCategory(filters.category);
  const params = [];
  let categorySql = "";

  if (category) {
    params.push(category);
    categorySql = ` AND c.course_category = $${params.length}`;
  }

  let scopeSql = "";
  let allocationJoinSql = "LEFT JOIN course_allocations a ON false";
  if (filters.user?.role === "school_admin") {
    params.push(filters.user.schoolId);
    scopeSql = ` AND c.school_id = $${params.length}`;
  } else if (filters.user?.role === "teacher") {
    params.push(filters.user.schoolId, filters.user.userId);
    scopeSql = ` AND c.school_id = $${params.length - 1}
      AND EXISTS (
        SELECT 1
        FROM course_teacher_assignments cta
        WHERE cta.course_id = c.id
          AND cta.teacher_user_id = $${params.length}
          AND cta.is_active = true
      )`;
  } else if (filters.user?.role === "learner") {
    params.push(filters.user.userId);
    allocationJoinSql = `LEFT JOIN course_allocations a
      ON a.course_id = c.id
      AND a.status IN ('active', 'in_progress', 'completed')
      AND EXISTS (
        SELECT 1
        FROM learners l
        WHERE l.id = a.learner_id
          AND l.user_id = $${params.length}
      )`;
    scopeSql = " AND a.id IS NOT NULL";
  } else if (filters.school_id) {
    params.push(filters.school_id);
    scopeSql = ` AND c.school_id = $${params.length}`;
  }

  const result = await query(
    `SELECT c.*,
            t.version AS current_template_version,
            (
              c.template_id IS NOT NULL
              AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
            ) AS update_available,
            a.id AS allocation_id,
            a.access_level,
            a.preview_activity_limit,
            a.paid_at,
            a.payment_reference
     FROM courses c
     LEFT JOIN course_templates t ON t.id = c.template_id
     ${allocationJoinSql}
     WHERE 1=1
       ${categorySql}
       ${scopeSql}
     ORDER BY c.course_category, c.name`,
    params
  );
  return result.rows;
}

async function createCourse(courseData) {
  const {
    name,
    description,
    school_id,
    code,
    target_level,
    image_url,
    estimated_weeks,
    learning_objectives,
    certificate_enabled,
    independent_price_amount,
    independent_currency,
    is_active,
  } = courseData;
  const courseCategory = normalizeCourseCategory(courseData.course_category);

  const result = await query(
    `INSERT INTO courses (
       school_id, name, code, description, target_level, image_url,
       estimated_weeks, learning_objectives, certificate_enabled,
       independent_price_amount, independent_currency, course_category, is_active
     )
     VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), NULLIF($6, ''),
             $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      school_id || null,
      name,
      code || null,
      description,
      target_level || null,
      image_url || null,
      estimated_weeks || null,
      JSON.stringify(learning_objectives || []),
      certificate_enabled === true,
      independent_price_amount || 0,
      independent_currency || "KES",
      courseCategory,
      is_active !== false,
    ]
  );
  return result.rows[0];
}

async function getCourseById(id, user = {}) {
  const access = await assertCourseAccess(id, user);
  return access.course || null;
}

async function updateCourse(id, courseData) {
  const {
    name,
    description,
    school_id,
    code,
    target_level,
    image_url,
    estimated_weeks,
    learning_objectives,
    certificate_enabled,
    independent_price_amount,
    independent_currency,
    is_active,
  } = courseData;
  const courseCategory = normalizeCourseCategory(courseData.course_category);

  const result = await query(
    `UPDATE courses c
     SET school_id = $1,
         name = $2,
         code = NULLIF($3, ''),
         description = $4,
         target_level = NULLIF($5, ''),
         image_url = NULLIF($6, ''),
         estimated_weeks = $7,
         learning_objectives = $8,
         certificate_enabled = $9,
         independent_price_amount = $10,
         independent_currency = $11,
         course_category = $12,
         is_active = $13,
         updated_at = CURRENT_TIMESTAMP
     WHERE c.id = $14
     RETURNING *`,
    [
      school_id || null,
      name,
      code || null,
      description,
      target_level || null,
      image_url || null,
      estimated_weeks || null,
      JSON.stringify(learning_objectives || []),
      certificate_enabled === true,
      independent_price_amount || 0,
      independent_currency || "KES",
      courseCategory,
      is_active !== false,
      id,
    ]
  );
  return result.rows[0];
}

async function deleteCourse(id) {
  await query(
    `DELETE FROM courses c
     WHERE c.id = $1`,
    [id]
  );
}

async function findLearnerForUser(userId) {
  const result = await query(
    "SELECT * FROM learners WHERE user_id = $1 AND is_active = true LIMIT 1",
    [userId]
  );
  return result.rows[0];
}

function isStaff(user = {}) {
  return ["system_admin", "school_admin", "teacher"].includes(user.role);
}

function isSchoolStaff(user = {}) {
  return ["school_admin", "teacher"].includes(user.role);
}

async function assertCourseManageAccess(courseId, user = {}) {
  if (user.role === "system_admin") return true;
  if (!isSchoolStaff(user) || !user.schoolId) return false;

  const result = await query(
    "SELECT id FROM courses WHERE id = $1 AND school_id = $2",
    [courseId, user.schoolId]
  );
  if (!result.rows[0]) return false;
  if (user.role === "teacher") {
    return teacherAssignmentsService.isTeacherAssignedToCourse(
      user.userId,
      courseId,
      user.schoolId
    );
  }
  return true;
}

async function bumpSchoolCourseVersion(courseId) {
  await query(
    `UPDATE courses
     SET school_version = COALESCE(school_version, 1) + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND school_id IS NOT NULL`,
    [courseId]
  );
}

function normalizeStatus(status) {
  const allowed = new Set([
    "not_started",
    "started",
    "in_progress",
    "submitted",
    "completed",
    "graded",
  ]);
  return allowed.has(status) ? status : "completed";
}

function activityDone(status) {
  return ["completed", "graded"].includes(status);
}

function normalizeQuestion(question = {}, index = 0, includeAnswer = false) {
  const points = Number(question.points ?? 1);
  const normalized = {
    id: question.id || `${index + 1}`,
    question_type: question.question_type || question.type || "multiple_choice",
    prompt: question.prompt || question.question || "",
    options: Array.isArray(question.options) ? question.options : [],
    image_url: question.image_url || "",
    points: Number.isFinite(points) && points >= 0 ? points : 1,
    position: Number(question.position || index + 1),
    feedback: question.feedback || "",
    hint: question.hint || "",
  };

  if (includeAnswer) {
    normalized.correct_answer =
      question.correct_answer ?? question.answer ?? question.correct ?? "";
    normalized.explanation = question.explanation || "";
  }

  return normalized;
}

function sanitizeActivityContent(content = {}, includeAnswers = false) {
  if (!content || typeof content !== "object") return {};
  const sanitized = { ...content };
  if (Array.isArray(sanitized.questions)) {
    sanitized.questions = sanitized.questions.map((question, index) =>
      normalizeQuestion(question, index, includeAnswers)
    );
  }
  return sanitized;
}

function normalizeAnswer(value, preserveOrder = false) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([key, item]) => [
        String(key).trim().toLowerCase(),
        String(item ?? "")
          .trim()
          .toLowerCase(),
      ])
      .sort(([left], [right]) => left.localeCompare(right));
  }
  if (Array.isArray(value)) {
    const normalized = value.map((item) =>
      typeof item === "object"
        ? JSON.stringify(item)
        : String(item ?? "")
            .trim()
            .toLowerCase()
    );
    return preserveOrder ? normalized : normalized.sort();
  }
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function answersMatch(expected, actual, questionType = "") {
  if (questionType === "true_false") {
    return normalizeBooleanAnswer(expected) === normalizeBooleanAnswer(actual);
  }
  if (questionType === "short_answer") {
    const accepted = Array.isArray(expected) ? expected : [expected];
    const normalizedActual = normalizeAnswer(actual);
    return accepted.some(
      (answer) => normalizeAnswer(answer) === normalizedActual
    );
  }
  const preserveOrder = questionType === "ordering";
  const normalizedExpected = normalizeAnswer(expected, preserveOrder);
  const normalizedActual = normalizeAnswer(actual, preserveOrder);

  if (Array.isArray(normalizedExpected) || Array.isArray(normalizedActual)) {
    return (
      JSON.stringify(normalizedExpected) === JSON.stringify(normalizedActual)
    );
  }

  return normalizedExpected === normalizedActual;
}

function validateQuizAllocation(data = {}) {
  if (data.activity_type !== "quiz") return;
  const questions = Array.isArray(data.content?.questions)
    ? data.content.questions
    : [];
  const allocated = questions.reduce((sum, question) => {
    const points = Number(question.points ?? 1);
    if (!Number.isFinite(points) || points < 0) {
      throw new Error("Each quiz question must have valid non-negative marks.");
    }
    return sum + points;
  }, 0);
  const available = Number(data.points ?? 0);
  if (!Number.isFinite(available) || available < 0) {
    throw new Error("Quiz total marks must be a valid non-negative number.");
  }
  if (allocated > available) {
    throw new Error(
      `Question marks total ${allocated}, which exceeds the quiz total of ${available}.`
    );
  }
}

function moduleSummary(module) {
  const required = module.activities.filter(
    (activity) => (activity.availability_mode || "required") === "required"
  );
  const optional = module.activities.filter(
    (activity) => activity.availability_mode === "try_more"
  );
  const total = required.length;
  const completed = required.filter((activity) =>
    activityDone(activity.status)
  ).length;
  const scores = required
    .map((activity) => Number(activity.score))
    .filter((score) => Number.isFinite(score));
  const score = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : Math.round((completed / Math.max(total, 1)) * 100);

  return {
    total_activities: total,
    completed_activities: completed,
    progress_percent: total ? Math.round((completed / total) * 100) : 0,
    score_percent: total ? score : 0,
    is_done: total > 0 && completed >= total,
    try_more_total: optional.length,
    try_more_completed: optional.filter((activity) =>
      activityDone(activity.status)
    ).length,
  };
}

async function assertCourseAccess(courseId, user = {}) {
  if (user.role === "system_admin") {
    const result = await query(
      `SELECT c.*,
              t.version AS current_template_version,
              (
                c.template_id IS NOT NULL
                AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
              ) AS update_available
       FROM courses c
       LEFT JOIN course_templates t ON t.id = c.template_id
       WHERE c.id = $1`,
      [courseId]
    );
    return { course: result.rows[0], learner: null };
  }
  if (isSchoolStaff(user)) {
    if (user.role === "teacher") {
      await teacherAssignmentsService.assertTeacherCourseAccess(user, courseId);
    }
    const result = await query(
      `SELECT c.*,
              t.version AS current_template_version,
              (
                c.template_id IS NOT NULL
                AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
              ) AS update_available
       FROM courses c
       LEFT JOIN course_templates t ON t.id = c.template_id
       WHERE c.id = $1 AND c.school_id = $2`,
      [courseId, user.schoolId]
    );
    return { course: result.rows[0], learner: null };
  }

  const learner = await findLearnerForUser(user.userId);
  if (!learner) return { course: null, learner: null };

  const result = await query(
    `SELECT c.*,
            t.version AS current_template_version,
            (
              c.template_id IS NOT NULL
              AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
            ) AS update_available,
            a.id AS allocation_id,
            a.access_level,
            a.preview_activity_limit,
            a.paid_at,
            a.payment_reference
     FROM courses c
     JOIN course_allocations a ON a.course_id = c.id
     LEFT JOIN course_templates t ON t.id = c.template_id
     WHERE c.id = $1
       AND a.learner_id = $2
       AND a.status IN ('active', 'in_progress', 'completed')
     LIMIT 1`,
    [courseId, learner.id]
  );
  const row = result.rows[0];
  return {
    course: row || null,
    learner,
    allocation: row
      ? {
          id: row.allocation_id,
          allocation_id: row.allocation_id,
          course_id: row.id,
          learner_id: learner.id,
          access_level: row.access_level || "paid",
          preview_activity_limit: row.preview_activity_limit || 0,
          paid_at: row.paid_at || null,
          payment_reference: row.payment_reference || null,
        }
      : null,
  };
}

function applyPreviewAccess(modules = [], allocation = null) {
  if (!allocation || allocation.access_level !== "preview") {
    return { modules, preview: null };
  }

  const activityLimit = Math.max(
    0,
    Number(allocation.preview_activity_limit || 0)
  );
  const firstModuleId = modules[0]?.id;
  let activityUsed = 0;
  let lockedActivities = 0;
  const paywallReason =
    "Pay to continue this course and get guidance from eduClub tutors.";

  const previewModules = modules.map((module) => {
    let moduleHasOpenActivity = false;
    const activities = module.activities.map((activity) => {
      const baseUnlocked = activity.is_unlocked !== false;
      const inFirstModule = Number(module.id) === Number(firstModuleId);
      const allowedByPreview = inFirstModule && activityUsed < activityLimit;

      if (baseUnlocked && allowedByPreview) activityUsed += 1;
      if (baseUnlocked && allowedByPreview) {
        moduleHasOpenActivity = true;
        return activity;
      }

      lockedActivities += 1;
      return {
        ...activity,
        is_unlocked: false,
        requires_payment: baseUnlocked,
        lock_reason: baseUnlocked
          ? paywallReason
          : activity.lock_reason || paywallReason,
      };
    });

    const isModuleOpen = module.is_unlocked !== false && moduleHasOpenActivity;
    return {
      ...module,
      activities,
      is_unlocked: isModuleOpen,
      requires_payment: activities.some(
        (activity) => activity.requires_payment
      ),
      lock_reason: isModuleOpen ? module.lock_reason : paywallReason,
    };
  });

  return {
    modules: previewModules,
    preview: {
      access_level: "preview",
      first_module_included: false,
      preview_activity_limit: activityLimit,
      preview_activities_remaining: Math.max(0, activityLimit - activityUsed),
      locked_activities: lockedActivities,
      paywall_message: paywallReason,
    },
  };
}

async function getCourseLearningOverview(courseId, user = {}) {
  const { course, learner, allocation } = await assertCourseAccess(
    courseId,
    user
  );
  if (!course) return null;

  const staffView = isStaff(user);
  const params = [courseId];
  let learnerJoin = "AND ap.learner_id IS NULL";

  if (learner) {
    params.push(learner.id);
    learnerJoin = "AND ap.learner_id = $2";
  }

  params.push(staffView);
  const staffParam = `$${params.length}`;

  const result = await query(
    `SELECT
       cm.id AS module_id,
       cm.template_module_id,
       cm.title AS module_title,
       cm.description AS module_description,
       cm.learning_outcomes,
       cm.position AS module_position,
       cm.is_published AS module_published,
       cm.unlock_at,
       sms.term_id AS schedule_term_id,
       sms.week_number AS schedule_week_number,
       sms.opens_at AS schedule_opens_at,
       la.id AS activity_id,
       la.template_activity_id,
       la.title AS activity_title,
       la.activity_type,
       la.content,
       la.points,
       la.position AS activity_position,
       la.is_required,
       COALESCE(la.availability_mode, 'required') AS availability_mode,
       la.completion_rule,
       la.pass_score,
       la.is_published AS activity_published,
       COALESCE(ap.status, 'not_started') AS status,
       ap.score,
       ap.completed_at,
       ap.updated_at AS progress_updated_at
     FROM course_modules cm
     LEFT JOIN school_module_schedules sms ON sms.module_id = cm.id
     LEFT JOIN learning_activities la
       ON la.module_id = cm.id
      AND (la.is_published = true OR ${staffParam} = true)
     LEFT JOIN activity_progress ap
       ON ap.activity_id = la.id
      ${learnerJoin}
     WHERE cm.course_id = $1
       AND (cm.is_published = true OR ${staffParam} = true)
     ORDER BY cm.position, la.position`,
    params
  );

  const moduleMap = new Map();
  result.rows.forEach((row) => {
    if (!moduleMap.has(row.module_id)) {
      moduleMap.set(row.module_id, {
        id: row.module_id,
        template_module_id: row.template_module_id,
        title: row.module_title,
        description: row.module_description,
        learning_outcomes: row.learning_outcomes || [],
        position: row.module_position,
        is_published: row.module_published,
        unlock_at: row.unlock_at,
        schedule: row.schedule_term_id
          ? {
              term_id: row.schedule_term_id,
              week_number: row.schedule_week_number,
              opens_at: row.schedule_opens_at,
            }
          : null,
        activities: [],
      });
    }

    if (row.activity_id) {
      moduleMap.get(row.module_id).activities.push({
        id: row.activity_id,
        template_activity_id: row.template_activity_id,
        title: row.activity_title,
        activity_type: row.activity_type,
        content: sanitizeActivityContent(row.content || {}, staffView),
        points: Number(row.points || 0),
        position: row.activity_position,
        is_required: row.is_required,
        availability_mode: row.availability_mode,
        completion_rule: row.completion_rule,
        pass_score: row.pass_score,
        is_published: row.activity_published,
        status: row.status,
        score: row.score === null ? null : Number(row.score),
        completed_at: row.completed_at,
        progress_updated_at: row.progress_updated_at,
      });
    }
  });

  let overrideRows = [];
  if (learner) {
    const overrides = await query(
      `SELECT o.*
       FROM learning_availability_overrides o
       WHERE o.course_id = $1::integer
         AND o.revoked_at IS NULL
         AND (
           o.target_learner_id = $2::integer
           OR COALESCE(o.target_learner_ids, '[]'::jsonb)
              @> jsonb_build_array($2::integer)
           OR (
             o.scope_type = 'class'
             AND (o.target_grade IS NULL OR o.target_grade = $3::varchar)
             AND (o.target_stream IS NULL OR o.target_stream = $4::varchar)
           )
         )`,
      [courseId, learner.id, learner.grade || null, learner.stream || null]
    );
    overrideRows = overrides.rows;
  }

  const builtModules = [...moduleMap.values()].map((module) => {
    const moduleOverride = overrideRows.some(
      (item) =>
        Number(item.module_id) === Number(module.id) && !item.activity_id
    );
    const availability = resolveModuleAvailability({
      opens_at: module.schedule?.opens_at,
      unlock_at: module.unlock_at,
      has_override: moduleOverride,
      staff_view: staffView,
    });
    const activities = annotateActivityAvailability(
      module.activities.map((activity) => ({
        ...activity,
        has_override: overrideRows.some(
          (item) => Number(item.activity_id) === Number(activity.id)
        ),
      })),
      availability.is_open
    ).map((activity) =>
      activity.has_override
        ? { ...activity, is_unlocked: true, lock_reason: null }
        : activity
    );
    const decorated = {
      ...module,
      activities,
      is_unlocked: availability.is_open,
      lock_reason: availability.is_open
        ? null
        : "This module has not opened yet.",
      opens_at:
        availability.opens_at || module.schedule?.opens_at || module.unlock_at,
    };
    return { ...decorated, ...moduleSummary(decorated) };
  });
  const { modules, preview } = applyPreviewAccess(builtModules, allocation);
  const completedModules = modules.filter((module) => module.is_done).length;
  const totalActivities = modules.reduce(
    (sum, module) => sum + module.total_activities,
    0
  );
  const completedActivities = modules.reduce(
    (sum, module) => sum + module.completed_activities,
    0
  );
  const courseScore = modules.length
    ? Math.round(
        modules.reduce((sum, module) => sum + module.score_percent, 0) /
          modules.length
      )
    : 0;

  return {
    course,
    learner,
    allocation,
    preview,
    modules,
    summary: {
      total_modules: modules.length,
      completed_modules: completedModules,
      total_activities: totalActivities,
      completed_activities: completedActivities,
      progress_percent: totalActivities
        ? Math.round((completedActivities / totalActivities) * 100)
        : 0,
      score_percent: courseScore,
      is_done: modules.length > 0 && completedModules >= modules.length,
    },
  };
}

async function assertActivityAccess(activityId, user = {}) {
  const result = await query(
    `SELECT la.*, cm.course_id, c.school_id
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE la.id = $1`,
    [activityId]
  );
  const activity = result.rows[0];
  if (!activity) return { activity: null, learner: null, staffView: false };

  if (isStaff(user)) {
    const schoolAllowed =
      isSchoolStaff(user) &&
      Number(activity.school_id) === Number(user.schoolId);
    const teacherAllowed =
      user.role !== "teacher" ||
      (await teacherAssignmentsService.isTeacherAssignedToCourse(
        user.userId,
        activity.course_id,
        user.schoolId
      ));
    const allowed =
      user.role === "system_admin" || (schoolAllowed && teacherAllowed);
    return {
      activity: allowed ? activity : null,
      learner: null,
      staffView: true,
    };
  }

  const learner = await findLearnerForUser(user.userId);
  if (!learner) return { activity: null, learner: null, staffView: false };

  const allocation = await query(
    `SELECT id
     FROM course_allocations
     WHERE course_id = $1
       AND learner_id = $2
       AND status IN ('active', 'in_progress', 'completed')
     LIMIT 1`,
    [activity.course_id, learner.id]
  );

  if (!allocation.rows[0]) return { activity: null, learner, staffView: false };
  const moduleLearning = await getModuleLearning(
    activity.course_id,
    activity.module_id,
    user
  );
  const learningActivity = moduleLearning?.module?.activities?.find(
    (item) => Number(item.id) === Number(activityId)
  );
  if (!moduleLearning?.is_unlocked || !learningActivity?.is_unlocked) {
    throw new Error(
      learningActivity?.lock_reason ||
        moduleLearning?.module?.lock_reason ||
        "Complete the previous required activity first."
    );
  }
  return { activity, learner, staffView: false };
}

async function ensureDiscussion(activity, user = {}) {
  const existing = await query(
    "SELECT * FROM discussions WHERE activity_id = $1 LIMIT 1",
    [activity.id]
  );
  if (existing.rows[0]) return existing.rows[0];

  const content = activity.content || {};
  const prompt =
    content.discussion_prompt ||
    content.prompt ||
    content.body ||
    content.description ||
    "Share your thoughts with the class.";

  const created = await query(
    `INSERT INTO discussions (
       activity_id, prompt, allow_peer_replies, created_by_user_id
     )
     VALUES ($1::integer, $2::text, $3::boolean, NULLIF($4::text, '')::integer)
     RETURNING *`,
    [
      activity.id,
      prompt,
      content.allow_peer_replies !== false,
      user.userId ? String(user.userId) : "",
    ]
  );
  return created.rows[0];
}

async function syncDiscussionSetup(activity, user = {}) {
  if (activity.activity_type !== "discussion") return null;
  const content = activity.content || {};
  const prompt =
    content.discussion_prompt ||
    content.prompt ||
    content.description ||
    "Share your thoughts with the class.";

  const existing = await query(
    "SELECT * FROM discussions WHERE activity_id = $1 LIMIT 1",
    [activity.id]
  );

  if (existing.rows[0]) {
    const result = await query(
      `UPDATE discussions
       SET prompt = $1,
           allow_peer_replies = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3::integer
       RETURNING *`,
      [prompt, content.allow_peer_replies !== false, existing.rows[0].id]
    );
    return result.rows[0];
  }

  return ensureDiscussion(activity, user);
}

async function getActivityDiscussion(activityId, user = {}) {
  const { activity } = await assertActivityAccess(activityId, user);
  if (!activity) throw new Error("Activity not found or not available.");
  if (activity.activity_type !== "discussion") {
    throw new Error("This activity is not a discussion.");
  }

  const discussion = await ensureDiscussion(activity, user);
  const replies = await query(
    `SELECT dr.*,
            COALESCE(l.full_name, u.full_name, u.email, 'Teacher') AS author_name,
            CASE WHEN dr.learner_id IS NULL THEN 'staff' ELSE 'learner' END AS author_type
     FROM discussion_replies dr
     LEFT JOIN learners l ON l.id = dr.learner_id
     LEFT JOIN users u ON u.id = dr.author_user_id
     WHERE dr.discussion_id = $1::integer
       AND dr.is_hidden = false
     ORDER BY dr.created_at ASC`,
    [discussion.id]
  );

  return { discussion, replies: replies.rows };
}

async function addDiscussionReply(activityId, user = {}, data = {}) {
  const { activity, learner, staffView } = await assertActivityAccess(
    activityId,
    user
  );
  if (!activity) throw new Error("Activity not found or not available.");
  if (activity.activity_type !== "discussion") {
    throw new Error("This activity is not a discussion.");
  }
  if (!staffView && !learner) throw new Error("Learner profile is required.");

  const body = String(data.body || "").trim();
  if (!body) throw new Error("Reply cannot be empty.");

  const discussion = await ensureDiscussion(activity, user);
  const result = await query(
    `INSERT INTO discussion_replies (
       discussion_id, learner_id, author_user_id, parent_reply_id, body
     )
     VALUES (
       $1::integer,
       NULLIF($2::text, '')::integer,
       NULLIF($3::text, '')::integer,
       NULLIF($4::text, '')::integer,
       $5::text
     )
     RETURNING *`,
    [
      discussion.id,
      learner?.id ? String(learner.id) : "",
      user.userId ? String(user.userId) : "",
      data.parent_reply_id ? String(data.parent_reply_id) : "",
      body,
    ]
  );

  if (learner) {
    await upsertActivityProgress(activityId, user, { status: "submitted" });
  }

  return result.rows[0];
}

async function submitActivityWork(activityId, user = {}, data = {}) {
  const { activity, learner } = await assertActivityAccess(activityId, user);
  if (!activity) throw new Error("Activity not found or not available.");
  if (!learner) throw new Error("Learner profile is required.");

  const allowedTypes = new Set([
    "assignment",
    "project",
    "reflection",
    "coding",
  ]);
  if (!allowedTypes.has(activity.activity_type)) {
    throw new Error("This activity does not accept submissions.");
  }

  const submissionType =
    data.submission_type ||
    (activity.activity_type === "coding" ? "code" : "text");
  const result = await query(
    `INSERT INTO activity_submissions (
       learner_id, activity_id, submission_type, content, submitted_at, status
     )
     VALUES ($1::integer, $2::integer, $3::varchar, $4::jsonb, CURRENT_TIMESTAMP, 'submitted'::varchar)
     ON CONFLICT (learner_id, activity_id)
     DO UPDATE SET
       submission_type = EXCLUDED.submission_type,
       content = EXCLUDED.content,
       submitted_at = CURRENT_TIMESTAMP,
       status = 'submitted'::varchar
     RETURNING *`,
    [learner.id, activityId, submissionType, JSON.stringify(data.content || {})]
  );

  await upsertActivityProgress(activityId, user, { status: "submitted" });
  let automatic_result = null;
  if (activity.activity_type === "coding") {
    const checks = Array.isArray(activity.content?.validation_checks)
      ? activity.content.validation_checks
      : [];
    if (checks.length) {
      automatic_result = evaluateSourceChecks(data.content || {}, checks);
      const total = automatic_result.total_points;
      const score = total
        ? Math.round((automatic_result.earned_points / total) * 100)
        : 0;
      await upsertActivityProgress(activityId, user, {
        status:
          score >= Number(activity.pass_score || 0) ? "graded" : "submitted",
        score,
      });
    }
  }
  return { ...result.rows[0], automatic_result };
}

async function submitQuiz(activityId, user = {}, data = {}) {
  const { activity, learner } = await assertActivityAccess(activityId, user);
  if (!activity) throw new Error("Activity not found or not available.");
  if (activity.activity_type !== "quiz")
    throw new Error("This activity is not a quiz.");
  if (!learner) throw new Error("Learner profile is required.");

  const questions = Array.isArray(activity.content?.questions)
    ? activity.content.questions.map((question, index) =>
        normalizeQuestion(question, index, true)
      )
    : [];
  if (questions.length === 0)
    throw new Error("This quiz has no questions yet.");

  const answers = data.answers || {};
  let earned = 0;
  const total = questions.reduce(
    (sum, question) => sum + Number(question.points || 0),
    0
  );
  const feedback = {};

  questions.forEach((question) => {
    const answer = answers[question.id] ?? answers[question.position];
    const correct = answersMatch(
      question.correct_answer,
      answer,
      question.question_type
    );
    if (correct) earned += Number(question.points || 0);
    feedback[question.id] = {
      correct,
      points: correct ? Number(question.points || 0) : 0,
      max_points: Number(question.points || 0),
      hint: correct ? "" : question.hint || "",
      explanation: question.explanation || "",
    };
  });

  const score = total ? Math.round((earned / total) * 100) : 0;
  const attemptNumber = await query(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
     FROM quiz_attempts
     WHERE learner_id = $1::integer
       AND activity_id = $2::integer`,
    [learner.id, activityId]
  );
  const attempt = await query(
    `INSERT INTO quiz_attempts (
       learner_id, activity_id, attempt_number, answers, score, feedback
     )
     VALUES ($1::integer, $2::integer, $3::integer, $4::jsonb, $5::numeric, $6::jsonb)
     RETURNING *`,
    [
      learner.id,
      activityId,
      attemptNumber.rows[0]?.next_attempt || 1,
      JSON.stringify(answers),
      score,
      JSON.stringify(feedback),
    ]
  );

  const passScore = Number(activity.pass_score ?? 0);
  const passed = score >= passScore;
  await upsertActivityProgress(
    activityId,
    user,
    { status: passed ? "graded" : "in_progress", score },
    { allowQuizCompletion: true, preserveMastery: true }
  );

  return {
    attempt: attempt.rows[0],
    score,
    earned_points: earned,
    total_points: total,
    feedback,
    passed,
    pass_score: passScore,
  };
}

async function getModuleLearning(courseId, moduleId, user = {}) {
  const overview = await getCourseLearningOverview(courseId, user);
  if (!overview) return null;

  const moduleIndex = overview.modules.findIndex(
    (module) => Number(module.id) === Number(moduleId)
  );
  if (moduleIndex === -1) return null;

  const module = overview.modules[moduleIndex];
  const nextModule = overview.modules[moduleIndex + 1] || null;
  const previousModule = overview.modules[moduleIndex - 1] || null;
  const isUnlocked = module.is_unlocked || isStaff(user);

  let badge = null;
  let feedback = null;
  if (overview.learner) {
    const badgeResult = await query(
      `SELECT * FROM learner_module_badges
       WHERE learner_id = $1::integer AND module_id = $2::integer
       LIMIT 1`,
      [overview.learner.id, moduleId]
    );
    badge = badgeResult.rows[0] || null;
    const feedbackResult = await query(
      `SELECT id, rating, comment, updated_at
       FROM module_feedback
       WHERE learner_id = $1::integer AND module_id = $2::integer
       LIMIT 1`,
      [overview.learner.id, moduleId]
    );
    feedback = feedbackResult.rows[0] || null;
  }

  return {
    course: overview.course,
    learner: overview.learner,
    module,
    previous_module: previousModule
      ? {
          id: previousModule.id,
          title: previousModule.title,
          is_done: previousModule.is_done,
        }
      : null,
    next_module: nextModule
      ? {
          id: nextModule.id,
          title: nextModule.title,
          is_done: nextModule.is_done,
          is_open: nextModule.is_unlocked || isStaff(user),
        }
      : null,
    course_summary: overview.summary,
    preview: overview.preview || null,
    is_unlocked: isUnlocked,
    badge,
    feedback,
  };
}

async function startCoursePayment(courseId, user = {}) {
  const { course, learner, allocation } = await assertCourseAccess(
    courseId,
    user
  );
  if (!course || !learner || !allocation) {
    throw new Error("Course is not available to this learner.");
  }
  if (allocation.access_level !== "preview") {
    return { status: "already_unlocked", allocation };
  }

  const independent = await independentLearnersService.isIndependentSchool(
    learner.school_id
  );
  if (!independent) {
    throw new Error(
      "Course payments are only available for independent learners."
    );
  }

  const amount = Number(course.independent_price_amount || 0);
  const currency = course.independent_currency || "KES";
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "This course does not have an access price configured yet."
    );
  }
  if (!flutterwave.isConfigured()) {
    throw new Error(
      "Payment is not configured yet. Contact the system administrator."
    );
  }

  const txRef = `educlub-course-${course.id}-${
    learner.id
  }-${crypto.randomUUID()}`;
  const payment = await flutterwave.createPaymentLink({
    txRef,
    amount,
    currency,
    redirectUrl: `${env.frontendUrl}/learner/courses/${
      course.id
    }?course_tx_ref=${encodeURIComponent(txRef)}`,
    customer: {
      email: learner.email || user.email,
      name: learner.full_name || user.fullName || user.username,
    },
    metadata: {
      paymentType: "course_access",
      courseId: course.id,
      courseName: course.name,
      learnerId: learner.id,
      allocationId: allocation.allocation_id,
    },
    title: "eduClub Course Access",
    description: course.name,
  });

  await query(
    `INSERT INTO course_payments (
       course_id, learner_id, allocation_id, tx_ref, amount, currency,
       status, payment_link, raw_response
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
    [
      course.id,
      learner.id,
      allocation.allocation_id,
      txRef,
      amount,
      currency,
      payment.link,
      JSON.stringify(payment.raw),
    ]
  );

  return { status: "payment_required", paymentLink: payment.link, txRef };
}

async function verifyCoursePayment({ transactionId, txRef }, user = {}) {
  if (!transactionId)
    throw new Error("Flutterwave transaction id is required.");
  if (!txRef) throw new Error("Payment reference is required.");

  const paymentResult = await query(
    `SELECT cp.*, l.user_id AS learner_user_id
     FROM course_payments cp
     JOIN learners l ON l.id = cp.learner_id
     WHERE cp.tx_ref = $1
     LIMIT 1`,
    [txRef]
  );
  const payment = paymentResult.rows[0];
  if (!payment) throw new Error("Payment record not found.");
  if (
    user.role === "learner" &&
    Number(payment.learner_user_id) !== Number(user.userId)
  ) {
    throw new Error("Payment is outside your learner account.");
  }

  if (payment.status === "successful") {
    return { status: "unlocked", alreadyVerified: true };
  }

  const verification = await flutterwave.verifyTransaction(transactionId);
  const data = verification.data || {};
  const successful =
    data.status === "successful" &&
    data.tx_ref === payment.tx_ref &&
    Number(data.amount) >= Number(payment.amount) &&
    data.currency === payment.currency;

  await query(
    `UPDATE course_payments
     SET status = $1,
         provider_transaction_id = $2,
         raw_response = $3,
         verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $4`,
    [
      successful ? "successful" : "failed",
      String(transactionId),
      JSON.stringify(verification),
      payment.id,
    ]
  );

  if (!successful) throw new Error("Payment could not be verified.");

  await query(
    `UPDATE course_allocations
     SET access_level = 'paid',
         paid_at = COALESCE(paid_at, NOW()),
         payment_reference = $1,
         status = CASE WHEN status = 'inactive' THEN 'active' ELSE status END
     WHERE id = $2`,
    [payment.tx_ref, payment.allocation_id]
  );

  return { status: "unlocked" };
}

function getWebhookTransaction(payload = {}) {
  return payload.data || payload.event?.data || {};
}

async function processCoursePaymentWebhook(payload = {}) {
  const eventType = payload.event || payload.type || "";
  const transaction = getWebhookTransaction(payload);
  const txRef = transaction.tx_ref || payload.tx_ref;
  const transactionId = transaction.id || transaction.transaction_id;

  if (eventType && eventType !== "charge.completed") {
    return {
      accepted: true,
      ignored: true,
      reason: "Webhook event is not a completed charge.",
      eventType,
    };
  }
  if (transaction.status && transaction.status !== "successful") {
    return {
      accepted: true,
      ignored: true,
      reason: "Webhook transaction is not successful.",
      eventType,
      txRef,
    };
  }
  if (!txRef || !transactionId) {
    return {
      accepted: true,
      ignored: true,
      reason: "Webhook did not include a tx_ref and transaction id.",
      eventType,
    };
  }

  return {
    accepted: true,
    eventType,
    txRef,
    transactionId,
    ...(await verifyCoursePayment({ transactionId, txRef })),
  };
}

async function upsertActivityProgress(
  activityId,
  user = {},
  data = {},
  options = {}
) {
  const activityAccess = await assertActivityAccess(activityId, user);
  const learner = activityAccess.learner;
  if (!learner)
    throw new Error("Learner profile is not linked to this account.");

  const access = await query(
    `SELECT la.id, la.module_id, la.points, la.activity_type, la.completion_rule, la.pass_score,
            cm.course_id,
            ca.term AS allocation_term,
            ca.academic_year AS allocation_academic_year
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     JOIN course_allocations ca ON ca.course_id = cm.course_id
     WHERE la.id = $1::integer
       AND ca.learner_id = $2::integer
       AND ca.status IN ('active', 'in_progress', 'completed')
     LIMIT 1`,
    [activityId, learner.id]
  );

  if (!access.rows[0])
    throw new Error("Activity is not available to this learner.");

  const status = normalizeStatus(data.status);
  if (
    access.rows[0].activity_type === "quiz" &&
    ["completed", "graded"].includes(status) &&
    options.allowQuizCompletion !== true
  ) {
    throw new Error("Quiz completion requires a passing quiz attempt.");
  }
  const score =
    data.score !== undefined && data.score !== null && data.score !== ""
      ? Math.max(0, Math.min(100, Number(data.score)))
      : status === "completed"
      ? 100
      : null;
  const masterySql = masteryUpdateSql("$6");

  const result = await query(
    `INSERT INTO activity_progress (
       learner_id, activity_id, status, score, opened_at, completed_at, updated_at
     )
     VALUES (
       $1::integer,
       $2::integer,
       $3::varchar,
       $4::numeric,
       COALESCE(NULLIF($5::text, '')::timestamp, NOW()),
       CASE WHEN $3::varchar IN ('completed'::varchar, 'graded'::varchar) THEN NOW() ELSE NULL END,
       NOW()
     )
     ON CONFLICT (learner_id, activity_id)
     DO UPDATE SET
       status = ${masterySql.status},
       score = ${masterySql.score},
       opened_at = COALESCE(activity_progress.opened_at, NOW()),
       completed_at = CASE
         WHEN EXCLUDED.status IN ('completed'::varchar, 'graded'::varchar)
         THEN COALESCE(activity_progress.completed_at, NOW())
         ELSE activity_progress.completed_at
       END,
       updated_at = NOW()
     RETURNING *`,
    [
      learner.id,
      activityId,
      status,
      score,
      data.opened_at || null,
      options.preserveMastery === true,
    ]
  );

  let badge = null;
  try {
    badge = await recalculateModuleBadge(learner.id, access.rows[0].module_id);
  } catch (error) {
    console.error("Module badge recalculation error:", error);
  }

  let certificate = null;
  try {
    certificate = await maybeCreateCourseCompletionCertificate({
      learnerId: learner.id,
      courseId: access.rows[0].course_id,
      term: access.rows[0].allocation_term || learner.term,
      academicYear:
        access.rows[0].allocation_academic_year || learner.academic_year,
    });
  } catch (error) {
    console.error("Course certificate completion check error:", error);
  }

  return { ...result.rows[0], badge, certificate };
}

async function maybeCreateCourseCompletionCertificate({
  learnerId,
  courseId,
  term,
  academicYear,
} = {}) {
  const summary = await query(
    `SELECT c.certificate_enabled,
            COUNT(la.id) FILTER (
              WHERE COALESCE(la.availability_mode, 'required') = 'required'
                AND la.is_published = true
                AND cm.is_published = true
            )::integer AS required_total,
            COUNT(ap.id) FILTER (
              WHERE COALESCE(la.availability_mode, 'required') = 'required'
                AND la.is_published = true
                AND cm.is_published = true
                AND ap.status IN ('completed', 'graded')
            )::integer AS required_done
     FROM courses c
     LEFT JOIN course_modules cm ON cm.course_id = c.id
     LEFT JOIN learning_activities la ON la.module_id = cm.id
     LEFT JOIN activity_progress ap
       ON ap.activity_id = la.id
      AND ap.learner_id = $2::integer
     WHERE c.id = $1::integer
     GROUP BY c.id, c.certificate_enabled`,
    [courseId, learnerId]
  );
  const row = summary.rows[0];
  if (
    !row?.certificate_enabled ||
    row.required_total <= 0 ||
    row.required_done < row.required_total
  ) {
    return null;
  }

  return certificatesService.ensureCourseCompletionCertificate({
    learnerId,
    courseId,
    term,
    academicYear,
  });
}

function toPositiveInteger(value, fallback, maxValue = null) {
  const parsed = Number.parseInt(value, 10);
  const normalized = Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  return maxValue ? Math.min(normalized, maxValue) : normalized;
}

function gradeToProgressScore(score, activityPoints) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return null;
  const maxPoints = Number(activityPoints || 0);
  if (maxPoints > 0) {
    return Math.max(
      0,
      Math.min(100, Math.round((numericScore / maxPoints) * 100))
    );
  }
  return Math.max(0, Math.min(100, numericScore));
}

async function assertActivityReviewAccess(activityId, user = {}) {
  if (!isStaff(user)) throw new Error("Only staff can review learner work.");

  const result = await query(
    `SELECT la.*,
            cm.course_id,
            cm.title AS module_title,
            c.name AS course_name,
            c.school_id
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE la.id = $1::integer`,
    [activityId]
  );
  const activity = result.rows[0];
  if (!activity) throw new Error("Activity not found.");

  const allowed = await assertCourseManageAccess(activity.course_id, user);
  if (!allowed) throw new Error("You cannot review this activity.");
  return activity;
}

async function getActivityReview(activityId, user = {}, filters = {}) {
  const activity = await assertActivityReviewAccess(activityId, user);
  const limit = toPositiveInteger(filters.limit, 50, 100);
  const offset = toPositiveInteger(filters.offset, 0);

  const totalResult = await query(
    `SELECT COUNT(*)::integer AS total
     FROM course_allocations ca
     JOIN learners l ON l.id = ca.learner_id
     WHERE ca.course_id = $1::integer
       AND ca.status IN ('active', 'in_progress', 'completed')
       AND l.is_active = true`,
    [activity.course_id]
  );

  const learnersResult = await query(
    `SELECT l.id AS learner_id,
            l.full_name,
            l.email,
            l.grade,
            l.stream,
            ap.status AS progress_status,
            ap.score AS progress_score,
            ap.opened_at,
            ap.completed_at,
            ap.graded_at AS progress_graded_at,
            ap.updated_at AS progress_updated_at,
            s.id AS submission_id,
            s.submission_type,
            s.content AS submission_content,
            s.submitted_at,
            s.status AS submission_status,
            g.id AS grade_id,
            g.score AS grade_score,
            g.question_marks,
            g.performance_level,
            g.teacher_remarks,
            g.graded_by_user_id,
            g.graded_at,
            qa.id AS latest_attempt_id,
            qa.attempt_number,
            qa.answers,
            qa.score AS quiz_score,
            qa.feedback AS quiz_feedback,
            qa.submitted_at AS quiz_submitted_at
     FROM course_allocations ca
     JOIN learners l ON l.id = ca.learner_id
     LEFT JOIN activity_progress ap
       ON ap.learner_id = l.id
      AND ap.activity_id = $1::integer
     LEFT JOIN activity_submissions s
       ON s.learner_id = l.id
      AND s.activity_id = $1::integer
     LEFT JOIN activity_grades g
       ON g.learner_id = l.id
      AND g.activity_id = $1::integer
     LEFT JOIN LATERAL (
       SELECT qa.*
       FROM quiz_attempts qa
       WHERE qa.learner_id = l.id
         AND qa.activity_id = $1::integer
       ORDER BY qa.attempt_number DESC
       LIMIT 1
     ) qa ON true
     WHERE ca.course_id = $2::integer
       AND ca.status IN ('active', 'in_progress', 'completed')
       AND l.is_active = true
     ORDER BY COALESCE(s.submitted_at, qa.submitted_at, ap.updated_at) DESC NULLS LAST,
              l.full_name
     LIMIT $3::integer OFFSET $4::integer`,
    [activityId, activity.course_id, limit, offset]
  );

  return {
    activity: {
      id: activity.id,
      course_id: activity.course_id,
      course_name: activity.course_name,
      module_title: activity.module_title,
      title: activity.title,
      activity_type: activity.activity_type,
      content: sanitizeActivityContent(activity.content || {}, true),
      points: Number(activity.points || 0),
      completion_rule: activity.completion_rule,
      pass_score: activity.pass_score,
    },
    learners: learnersResult.rows,
    paging: {
      total: totalResult.rows[0]?.total || 0,
      limit,
      offset,
    },
  };
}

async function gradeActivityForLearner(
  activityId,
  learnerId,
  user = {},
  data = {}
) {
  const activity = await assertActivityReviewAccess(activityId, user);
  const allocation = await query(
    `SELECT ca.id
     FROM course_allocations ca
     JOIN learners l ON l.id = ca.learner_id
     WHERE ca.course_id = $1::integer
       AND ca.learner_id = $2::integer
       AND ca.status IN ('active', 'in_progress', 'completed')
       AND l.is_active = true
     LIMIT 1`,
    [activity.course_id, learnerId]
  );
  if (!allocation.rows[0])
    throw new Error("Learner is not allocated to this course.");

  const score = normalizeActivityGrade(data.score, activity.points);

  const submission = await query(
    `SELECT id
     FROM activity_submissions
     WHERE learner_id = $1::integer
       AND activity_id = $2::integer
     LIMIT 1`,
    [learnerId, activityId]
  );
  const submissionId = submission.rows[0]?.id || null;
  const progressScore = gradeToProgressScore(score, activity.points);

  const grade = await query(
    `INSERT INTO activity_grades (
       submission_id, learner_id, activity_id, score, question_marks, performance_level,
       teacher_remarks, graded_by_user_id, graded_at
     )
     VALUES (
       NULLIF($1::text, '')::integer,
       $2::integer,
       $3::integer,
       $4::numeric,
       $5::jsonb,
       NULLIF($6::text, '')::varchar,
       NULLIF($7::text, ''),
       NULLIF($8::text, '')::integer,
       CURRENT_TIMESTAMP
     )
     ON CONFLICT (learner_id, activity_id)
     DO UPDATE SET
       submission_id = COALESCE(EXCLUDED.submission_id, activity_grades.submission_id),
       score = EXCLUDED.score,
       question_marks = EXCLUDED.question_marks,
       performance_level = EXCLUDED.performance_level,
       teacher_remarks = EXCLUDED.teacher_remarks,
       graded_by_user_id = EXCLUDED.graded_by_user_id,
       graded_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      submissionId ? String(submissionId) : "",
      learnerId,
      activityId,
      score,
      JSON.stringify(data.question_marks || {}),
      data.performance_level || "",
      data.teacher_remarks || "",
      user.userId ? String(user.userId) : "",
    ]
  );

  await query(
    `INSERT INTO activity_progress (
       learner_id, activity_id, status, score, opened_at, completed_at, graded_at, updated_at
     )
     VALUES (
       $1::integer,
       $2::integer,
       'graded'::varchar,
       $3::numeric,
       NOW(),
       NOW(),
       NOW(),
       NOW()
     )
     ON CONFLICT (learner_id, activity_id)
     DO UPDATE SET
       status = 'graded'::varchar,
       score = COALESCE(EXCLUDED.score, activity_progress.score),
       opened_at = COALESCE(activity_progress.opened_at, NOW()),
       completed_at = COALESCE(activity_progress.completed_at, NOW()),
       graded_at = NOW(),
       updated_at = NOW()`,
    [learnerId, activityId, progressScore]
  );

  if (submissionId) {
    await query(
      `UPDATE activity_submissions
       SET status = 'graded'::varchar
       WHERE id = $1::integer`,
      [submissionId]
    );
  }

  try {
    await recalculateModuleBadge(learnerId, activity.module_id);
  } catch (error) {
    console.error("Module badge recalculation error:", error);
  }

  try {
    const allocation = await query(
      `SELECT term, academic_year
       FROM course_allocations
       WHERE course_id = $1::integer
         AND learner_id = $2::integer
         AND status IN ('active', 'in_progress', 'completed')
       LIMIT 1`,
      [activity.course_id, learnerId]
    );
    await maybeCreateCourseCompletionCertificate({
      learnerId,
      courseId: activity.course_id,
      term: allocation.rows[0]?.term,
      academicYear: allocation.rows[0]?.academic_year,
    });
  } catch (error) {
    console.error("Course certificate grade completion check error:", error);
  }

  return grade.rows[0];
}

async function saveModuleSchedule(moduleId, user = {}, data = {}) {
  if (!data.schedule_term_id || !data.schedule_week_number) {
    await query(
      "DELETE FROM school_module_schedules WHERE module_id = $1::integer",
      [moduleId]
    );
    return null;
  }
  const week = await query(
    `SELECT tw.start_date
     FROM term_weeks tw
     JOIN terms t ON t.id = tw.term_id
     WHERE tw.term_id = $1::integer
       AND tw.week_number = $2::integer
       AND t.is_active = true
     LIMIT 1`,
    [data.schedule_term_id, data.schedule_week_number]
  );
  if (!week.rows[0]) throw new Error("Choose a valid week in the active term.");
  const result = await query(
    `INSERT INTO school_module_schedules (
       module_id, term_id, week_number, opens_at, created_by_user_id
     )
     VALUES ($1::integer, $2::integer, $3::integer, $4::date, $5::integer)
     ON CONFLICT (module_id)
     DO UPDATE SET
       term_id = EXCLUDED.term_id,
       week_number = EXCLUDED.week_number,
       opens_at = EXCLUDED.opens_at,
       created_by_user_id = EXCLUDED.created_by_user_id,
       updated_at = NOW()
     RETURNING *`,
    [
      moduleId,
      data.schedule_term_id,
      data.schedule_week_number,
      week.rows[0].start_date,
      user.userId,
    ]
  );
  return result.rows[0];
}

async function createModule(courseId, data = {}) {
  const result = await query(
    `INSERT INTO course_modules (
       course_id, title, description, learning_outcomes, position, is_published, unlock_at
     )
     VALUES (
       $1, $2, $3, $4,
       COALESCE($5, (SELECT COALESCE(MAX(position), 0) + 1 FROM course_modules WHERE course_id = $1)),
       $6, NULLIF($7, '')::timestamp
     )
     RETURNING *`,
    [
      courseId,
      data.title,
      data.description || "",
      JSON.stringify(data.learning_outcomes || []),
      data.position || null,
      data.is_published !== false,
      data.unlock_at || null,
    ]
  );
  return result.rows[0];
}

async function createManagedModule(courseId, user = {}, data = {}) {
  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this course.");
  const module = await createModule(courseId, data);
  if (user.role !== "system_admin")
    await saveModuleSchedule(module.id, user, data);
  await bumpSchoolCourseVersion(courseId);
  return module;
}

async function updateModule(moduleId, user = {}, data = {}) {
  const moduleCourse = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId]
  );
  const courseId = moduleCourse.rows[0]?.course_id;
  if (!courseId) return null;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this module.");

  const result = await query(
    `UPDATE course_modules
     SET title = $1,
         description = $2,
         learning_outcomes = $3,
         position = $4,
         is_published = $5,
         unlock_at = NULLIF($6, '')::timestamp,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [
      data.title,
      data.description || "",
      JSON.stringify(data.learning_outcomes || []),
      data.position || 1,
      data.is_published !== false,
      data.unlock_at || null,
      moduleId,
    ]
  );
  await bumpSchoolCourseVersion(courseId);
  if (user.role !== "system_admin")
    await saveModuleSchedule(moduleId, user, data);
  return result.rows[0];
}

async function deleteModule(moduleId, user = {}) {
  const moduleCourse = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId]
  );
  const courseId = moduleCourse.rows[0]?.course_id;
  if (!courseId) return;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot delete this module.");

  await query("DELETE FROM course_modules WHERE id = $1", [moduleId]);
  await bumpSchoolCourseVersion(courseId);
}

async function createActivity(moduleId, data = {}) {
  const safeContent = sanitizeActivityContentForStorage(data.content || {});
  const result = await query(
    `INSERT INTO learning_activities (
       module_id, title, activity_type, content, points, position,
       is_required, availability_mode, completion_rule, pass_score, is_published
     )
     VALUES (
       $1, $2, $3, $4, $5,
       COALESCE($6, (SELECT COALESCE(MAX(position), 0) + 1 FROM learning_activities WHERE module_id = $1)),
       $7, $8, $9, $10, $11
     )
     RETURNING *`,
    [
      moduleId,
      data.title,
      data.activity_type || "lesson",
      JSON.stringify(safeContent),
      data.points || 0,
      data.position || null,
      data.is_required !== false,
      data.availability_mode === "try_more" ? "try_more" : "required",
      data.completion_rule || "manual",
      data.pass_score || null,
      data.is_published !== false,
    ]
  );
  return result.rows[0];
}

async function createManagedActivity(moduleId, user = {}, data = {}) {
  const moduleCourse = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId]
  );
  const courseId = moduleCourse.rows[0]?.course_id;
  if (!courseId) throw new Error("Module not found.");

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this module.");

  validateQuizAllocation(data);
  validateCodingChallenge(data);
  const activity = await createActivity(moduleId, data);
  await syncDiscussionSetup(activity, user);
  await bumpSchoolCourseVersion(courseId);
  return activity;
}

async function updateActivity(activityId, user = {}, data = {}) {
  const activityCourse = await query(
    `SELECT cm.course_id
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     WHERE la.id = $1`,
    [activityId]
  );
  const courseId = activityCourse.rows[0]?.course_id;
  if (!courseId) return null;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this activity.");

  validateQuizAllocation(data);
  validateCodingChallenge(data);
  const safeContent = sanitizeActivityContentForStorage(data.content || {});
  const result = await query(
    `UPDATE learning_activities
     SET title = $1,
         activity_type = $2,
         content = $3,
         points = $4,
         position = $5,
         is_required = $6,
         availability_mode = $7,
         completion_rule = $8,
         pass_score = $9,
         is_published = $10,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11
     RETURNING *`,
    [
      data.title,
      data.activity_type || "lesson",
      JSON.stringify(safeContent),
      data.points || 0,
      data.position || 1,
      data.is_required !== false,
      data.availability_mode === "try_more" ? "try_more" : "required",
      data.completion_rule || "manual",
      data.pass_score || null,
      data.is_published !== false,
      activityId,
    ]
  );
  if (result.rows[0]) {
    await syncDiscussionSetup(result.rows[0], user);
  }
  await bumpSchoolCourseVersion(courseId);
  return result.rows[0];
}

async function deleteActivity(activityId, user = {}) {
  const activityCourse = await query(
    `SELECT cm.course_id
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     WHERE la.id = $1`,
    [activityId]
  );
  const courseId = activityCourse.rows[0]?.course_id;
  if (!courseId) return;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot delete this activity.");

  await query("DELETE FROM learning_activities WHERE id = $1", [activityId]);
  await bumpSchoolCourseVersion(courseId);
}

async function reorderActivities(moduleId, user = {}, activityIds = []) {
  const moduleCourse = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId]
  );
  const courseId = moduleCourse.rows[0]?.course_id;
  if (!courseId) throw new Error("Module not found.");

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed)
    throw new Error("You cannot reorder activities in this module.");

  const orderedIds = (Array.isArray(activityIds) ? activityIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!orderedIds.length) throw new Error("Activity order is required.");

  const existing = await query(
    `SELECT id
     FROM learning_activities
     WHERE module_id = $1::integer
       AND id = ANY($2::integer[])`,
    [moduleId, orderedIds]
  );
  if (existing.rows.length !== orderedIds.length) {
    throw new Error("Activity order contains an item outside this module.");
  }

  await query(
    `UPDATE learning_activities
     SET position = -100000 - position
     WHERE module_id = $1::integer
       AND id = ANY($2::integer[])`,
    [moduleId, orderedIds]
  );

  for (const [index, activityId] of orderedIds.entries()) {
    await query(
      `UPDATE learning_activities
       SET position = $1::integer,
           updated_at = CURRENT_TIMESTAMP
       WHERE module_id = $2::integer
         AND id = $3::integer`,
      [index + 1, moduleId, activityId]
    );
  }

  await bumpSchoolCourseVersion(courseId);

  const result = await query(
    `SELECT *
     FROM learning_activities
     WHERE module_id = $1::integer
     ORDER BY position`,
    [moduleId]
  );
  return result.rows;
}

async function createAvailabilityOverride(courseId, user = {}, data = {}) {
  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed || !isSchoolStaff(user)) {
    throw new Error("Only school staff can unlock school course content.");
  }
  const reason = String(data.reason || "").trim();
  if (!reason) throw new Error("Please record a reason for the early unlock.");
  const scopeType = ["class", "learners", "learner"].includes(data.scope_type)
    ? data.scope_type
    : "learner";
  const result = await query(
    `INSERT INTO learning_availability_overrides (
       school_id, course_id, module_id, activity_id, scope_type,
       target_learner_id, target_learner_ids, target_grade, target_stream,
       reason, created_by_user_id
     )
     VALUES (
       $1::integer, $2::integer, NULLIF($3::text, '')::integer,
       NULLIF($4::text, '')::integer, $5::varchar,
       NULLIF($6::text, '')::integer, $7::jsonb, NULLIF($8::text, ''),
       NULLIF($9::text, ''), $10::text, $11::integer
     )
     RETURNING *`,
    [
      user.schoolId,
      courseId,
      data.module_id ? String(data.module_id) : "",
      data.activity_id ? String(data.activity_id) : "",
      scopeType,
      data.learner_id ? String(data.learner_id) : "",
      JSON.stringify(data.learner_ids || []),
      data.grade || "",
      data.stream || "",
      reason,
      user.userId,
    ]
  );
  return result.rows[0];
}

async function listAvailabilityOverrides(courseId, user = {}) {
  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot view these unlocks.");
  const result = await query(
    `SELECT o.*, u.full_name AS created_by_name
     FROM learning_availability_overrides o
     LEFT JOIN users u ON u.id = o.created_by_user_id
     WHERE o.course_id = $1::integer
       AND o.revoked_at IS NULL
     ORDER BY o.created_at DESC`,
    [courseId]
  );
  return result.rows;
}

async function revokeAvailabilityOverride(overrideId, user = {}) {
  if (!isSchoolStaff(user))
    throw new Error("Only school staff can revoke an unlock.");
  const result = await query(
    `UPDATE learning_availability_overrides
     SET revoked_at = NOW()
     WHERE id = $1::integer
       AND school_id = $2::integer
     RETURNING *`,
    [overrideId, user.schoolId]
  );
  if (!result.rows[0]) throw new Error("Unlock override not found.");
  return result.rows[0];
}

async function getLearnerBadges(user = {}) {
  const learner = await findLearnerForUser(user.userId);
  if (!learner) throw new Error("Learner profile is required.");
  return listLearnerBadges(learner.id);
}

async function submitModuleFeedback(moduleId, user = {}, data = {}) {
  const learner = await findLearnerForUser(user.userId);
  if (!learner) throw new Error("Learner profile is required.");
  return moduleFeedbackService.upsertModuleFeedback(moduleId, learner, data);
}

async function getModuleFeedbackSummary(moduleId, user = {}) {
  if (!isStaff(user)) throw new Error("Staff access is required.");
  const moduleResult = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId]
  );
  const allowed = await assertCourseManageAccess(
    moduleResult.rows[0]?.course_id,
    user
  );
  if (!allowed) throw new Error("You cannot view feedback for this module.");
  return moduleFeedbackService.getModuleFeedbackSummary(moduleId, user);
}

async function getTemplateFeedbackReport(templateId, user = {}, filters = {}) {
  return moduleFeedbackService.getTemplateFeedbackReport(
    templateId,
    user,
    filters
  );
}

async function getCourseFeedbackReport(courseId, user = {}, filters = {}) {
  if (!isStaff(user)) throw new Error("Staff access is required.");
  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot view feedback for this course.");
  return moduleFeedbackService.getCourseFeedbackReport(courseId, user, filters);
}

async function revealModuleFeedbackIdentity(feedbackId, user = {}, data = {}) {
  return moduleFeedbackService.revealFeedbackIdentity(
    feedbackId,
    user,
    data.reason
  );
}

module.exports = {
  getAllCourses,
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  normalizeCourseCategory,
  assertActivityAccess,
  getCourseLearningOverview,
  getModuleLearning,
  startCoursePayment,
  verifyCoursePayment,
  processCoursePaymentWebhook,
  upsertActivityProgress,
  createModule,
  createManagedModule,
  updateModule,
  deleteModule,
  createActivity,
  createManagedActivity,
  updateActivity,
  deleteActivity,
  reorderActivities,
  getActivityDiscussion,
  addDiscussionReply,
  submitActivityWork,
  submitQuiz,
  getActivityReview,
  gradeActivityForLearner,
  createAvailabilityOverride,
  listAvailabilityOverrides,
  revokeAvailabilityOverride,
  getLearnerBadges,
  submitModuleFeedback,
  getModuleFeedbackSummary,
  getTemplateFeedbackReport,
  getCourseFeedbackReport,
  revealModuleFeedbackIdentity,
  syncSchoolCourse: courseTemplatesService.syncSchoolCourse,
  rollbackSchoolCourse: courseTemplatesService.rollbackSchoolCourse,
};

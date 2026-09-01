const { query } = require("../config");
const PDFDocument = require("pdfkit");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const courseProgressService = require("./courseProgress.service");
const { getBadgeTier } = require("./moduleBadges.service");
const { getTypingBadge } = require("./typingBadges");

const DEFAULT_REPORT_CARD_SETTINGS = Object.freeze({
  show_weekly_typing: true,
  show_weekly_quizzes: true,
  show_active_courses: true,
  show_competitions: true,
  show_badges: true,
  show_teacher_feedback: true,
});

function normalizeReportCardSettings(settings = {}) {
  const source =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? settings
      : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_REPORT_CARD_SETTINGS).map(([key, value]) => [
      key,
      source[key] === undefined ? value : Boolean(source[key]),
    ])
  );
}

async function ensureReportCardSettingsColumn() {
  await query(
    `ALTER TABLE IF EXISTS schools
     ADD COLUMN IF NOT EXISTS report_card_settings JSONB
     DEFAULT '{"show_weekly_typing":true,"show_weekly_quizzes":true,"show_active_courses":true,"show_competitions":true,"show_badges":true,"show_teacher_feedback":true}'::jsonb`
  );
}

async function getReportCardSettings(schoolId) {
  if (!schoolId) return normalizeReportCardSettings();
  await ensureReportCardSettingsColumn();
  const result = await query(
    "SELECT report_card_settings FROM schools WHERE id = $1 LIMIT 1",
    [schoolId]
  );
  return normalizeReportCardSettings(result.rows[0]?.report_card_settings);
}

async function saveReportCardSettings(user, schoolId, settings) {
  if (!user || !["system_admin", "school_admin"].includes(user.role)) {
    const error = new Error(
      "Only school admins can update report card settings."
    );
    error.statusCode = 403;
    throw error;
  }
  const targetSchoolId =
    user.role === "system_admin" ? Number(schoolId) : Number(user.schoolId);
  if (!targetSchoolId) {
    const error = new Error("School is required.");
    error.statusCode = 400;
    throw error;
  }
  if (
    user.role === "school_admin" &&
    Number(targetSchoolId) !== Number(user.schoolId)
  ) {
    const error = new Error("School is outside your access.");
    error.statusCode = 403;
    throw error;
  }
  const normalized = normalizeReportCardSettings(settings);
  await ensureReportCardSettingsColumn();
  const result = await query(
    `UPDATE schools
     SET report_card_settings = $2::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING report_card_settings`,
    [targetSchoolId, JSON.stringify(normalized)]
  );
  if (!result.rows[0]) {
    const error = new Error("School not found.");
    error.statusCode = 404;
    throw error;
  }
  return normalizeReportCardSettings(result.rows[0].report_card_settings);
}

async function ensureReportFeedbackTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS report_feedback (
      id SERIAL PRIMARY KEY,
      learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      term VARCHAR(50) NOT NULL,
      academic_year INTEGER NOT NULL,
      comment_text TEXT NOT NULL,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(learner_id, term, academic_year)
    )
  `);
  await query(
    "CREATE INDEX IF NOT EXISTS idx_report_feedback_period ON report_feedback(school_id, academic_year, term)"
  );
  await query("ALTER TABLE report_feedback ENABLE ROW LEVEL SECURITY");
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'report_feedback'
          AND policyname = 'report_feedback_role_access'
      ) THEN
        CREATE POLICY report_feedback_role_access ON report_feedback
          FOR SELECT
          USING (
            (SELECT public.educlub_role()) = 'system_admin'
            OR EXISTS (
              SELECT 1 FROM learners l
              WHERE l.id = learner_id
                AND (
                  (
                    (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
                    AND l.school_id = (SELECT public.educlub_school_id())
                  )
                  OR (
                    (SELECT public.educlub_role()) = 'learner'
                    AND l.user_id = (SELECT public.educlub_user_id())
                  )
                )
            )
          );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'report_feedback'
          AND policyname = 'report_feedback_staff_insert'
      ) THEN
        CREATE POLICY report_feedback_staff_insert ON report_feedback
          FOR INSERT
          WITH CHECK (
            (SELECT public.educlub_role()) = 'system_admin'
            OR EXISTS (
              SELECT 1 FROM learners l
              WHERE l.id = learner_id
                AND l.school_id = school_id
                AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
                AND l.school_id = (SELECT public.educlub_school_id())
            )
          );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'report_feedback'
          AND policyname = 'report_feedback_staff_update'
      ) THEN
        CREATE POLICY report_feedback_staff_update ON report_feedback
          FOR UPDATE
          USING (
            (SELECT public.educlub_role()) = 'system_admin'
            OR EXISTS (
              SELECT 1 FROM learners l
              WHERE l.id = learner_id
                AND l.school_id = school_id
                AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
                AND l.school_id = (SELECT public.educlub_school_id())
            )
          )
          WITH CHECK (
            (SELECT public.educlub_role()) = 'system_admin'
            OR EXISTS (
              SELECT 1 FROM learners l
              WHERE l.id = learner_id
                AND l.school_id = school_id
                AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
                AND l.school_id = (SELECT public.educlub_school_id())
            )
          );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'report_feedback'
          AND policyname = 'report_feedback_staff_delete'
      ) THEN
        CREATE POLICY report_feedback_staff_delete ON report_feedback
          FOR DELETE
          USING (
            (SELECT public.educlub_role()) = 'system_admin'
            OR EXISTS (
              SELECT 1 FROM learners l
              WHERE l.id = learner_id
                AND l.school_id = school_id
                AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
                AND l.school_id = (SELECT public.educlub_school_id())
            )
          );
      END IF;
    END
    $$;
  `);
}

async function getAllReports() {
  const result = await query("SELECT * FROM reports ORDER BY created_at DESC");
  return result.rows;
}

async function getLearnerReports(learnerId) {
  const result = await query(
    `SELECT r.*, l.full_name as learner_name, c.name as course_name
     FROM reports r
     JOIN learners l ON r.learner_id = l.id
     LEFT JOIN courses c ON r.course_id = c.id
     WHERE r.learner_id = $1
     ORDER BY r.created_at DESC`,
    [learnerId]
  );
  return result.rows;
}

async function getSchoolReports(schoolId) {
  const result = await query(
    `SELECT r.*, l.full_name as learner_name, s.name as school_name, c.name as course_name
     FROM reports r
     JOIN learners l ON r.learner_id = l.id
     JOIN schools s ON l.school_id = s.id
     LEFT JOIN courses c ON r.course_id = c.id
     WHERE l.school_id = $1
     ORDER BY r.created_at DESC`,
    [schoolId]
  );
  return result.rows;
}

async function getCourseReports(courseId) {
  const result = await query(
    `SELECT r.*, l.full_name as learner_name, c.name as course_name
     FROM reports r
     JOIN learners l ON r.learner_id = l.id
     JOIN courses c ON r.course_id = c.id
     WHERE r.course_id = $1
     ORDER BY r.created_at DESC`,
    [courseId]
  );
  return result.rows;
}

async function generateReport(reportData) {
  const { learner_id, course_id, report_type, term, academic_year, data } =
    reportData;

  const result = await query(
    `INSERT INTO reports (learner_id, course_id, report_type, term, academic_year, data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      learner_id,
      course_id,
      report_type,
      term,
      academic_year,
      JSON.stringify(data),
    ]
  );
  return result.rows[0];
}

// Get weekly marks for a learner
async function getWeeklyMarks(learnerId, term, academicYear) {
  const result = await query(
    `SELECT tw.week_number,
            wm.quiz_score,
            wm.typing_score,
            wm.active_course_score,
            wm.active_course_modules_completed,
            wm.active_course_modules_total
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     JOIN term_weeks tw ON tw.term_id = t.id
     LEFT JOIN weekly_marks wm
       ON wm.learner_id = $1
      AND wm.term = t.name
      AND wm.academic_year = ay.year
      AND wm.week_number = tw.week_number
     WHERE t.name = $2 AND ay.year = $3
     ORDER BY tw.week_number`,
    [learnerId, term, academicYear]
  );
  if (result.rows.length > 0) return result.rows;
  const fallback = await query(
    `SELECT * FROM weekly_marks
     WHERE learner_id = $1 AND term = $2 AND academic_year = $3
     ORDER BY week_number`,
    [learnerId, term, academicYear]
  );
  return fallback.rows;
}

// Get weekly marks for multiple learners (class or school)
async function getWeeklyMarksForLearners(learnerIds, term, academicYear) {
  const result = await query(
    `SELECT wm.*, l.full_name, l.grade, l.stream 
     FROM weekly_marks wm
     JOIN learners l ON wm.learner_id = l.id
     WHERE wm.learner_id = ANY($1) AND wm.term = $2 AND wm.academic_year = $3 
     ORDER BY l.full_name, wm.week_number`,
    [learnerIds, term, academicYear]
  );
  return result.rows;
}

// Generate performance label based on score
function getPerformanceLabel(score) {
  if (score <= 50) return "Approaching";
  if (score <= 80) return "Meets Expectation";
  return "Exceeding Expectation";
}

function getEduClubLogoPath() {
  const logoPath = path.join(
    __dirname,
    "../../../uploads/educlub-logo/educlub logo.png"
  );
  return fs.existsSync(logoPath) ? logoPath : null;
}

function getUploadLocalPath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") {
    return null;
  }

  let uploadPath = fileUrl;
  try {
    if (/^https?:\/\//i.test(fileUrl)) {
      uploadPath = new URL(fileUrl).pathname;
    }
  } catch (error) {
    uploadPath = fileUrl;
  }

  if (!uploadPath.startsWith("/uploads/")) {
    return null;
  }

  return path.join(__dirname, "../..", uploadPath);
}

function drawPill(doc, text, x, y, width, color) {
  doc.roundedRect(x, y, width, 18, 9).fill(color);
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(text, x, y + 5, {
      width,
      align: "center",
    });
}

function drawSectionTitle(doc, number, title, x, y, width) {
  doc.roundedRect(x, y, width, 28, 7).fill("#003f91");
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(number ? `${number}. ${title}` : title, x + 10, y + 9);
}

function drawLineChart(doc, rows, key, x, y, width, height, suffix = "") {
  const axis = rows.map((row) => ({
    week: row.week_number,
    value:
      row[key] === null || row[key] === undefined || row[key] === ""
        ? null
        : Number(row[key]),
  }));
  const data = axis.filter(
    (row) => row.value !== null && !Number.isNaN(row.value)
  );

  doc.strokeColor("#c6ccd8").lineWidth(1);
  doc
    .moveTo(x + 35, y + 18)
    .lineTo(x + 35, y + height - 25)
    .lineTo(x + width - 20, y + height - 25)
    .stroke();

  const plotLeft = x + 35;
  const plotRight = x + width - 28;
  const plotTop = y + 18;
  const plotBottom = y + height - 25;
  const step =
    axis.length === 1
      ? 0
      : (plotRight - plotLeft) / Math.max(axis.length - 1, 1);
  axis.forEach((item, index) => {
    const labelX =
      axis.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + index * step;
    doc
      .fillColor("#4d5b73")
      .font("Helvetica")
      .fontSize(axis.length > 12 ? 5 : 6)
      .text(`W${item.week}`, labelX - 8, plotBottom + 7, {
        width: 16,
        align: "center",
      });
  });

  if (data.length === 0) {
    doc
      .fillColor("#4d5b73")
      .font("Helvetica")
      .fontSize(9)
      .text("No data yet.", x + 45, y + 50);
    return;
  }

  const max = Math.max(100, ...data.map((item) => item.value));
  const points = data.map((item) => ({
    x:
      axis.length === 1
        ? (plotLeft + plotRight) / 2
        : plotLeft + axis.findIndex((entry) => entry.week === item.week) * step,
    y: plotBottom - (item.value / max) * (plotBottom - plotTop),
    ...item,
  }));

  doc.strokeColor("#003f91").lineWidth(1.5);
  points.forEach((point, index) => {
    if (index === 0) {
      doc.moveTo(point.x, point.y);
    } else {
      doc.lineTo(point.x, point.y);
    }
  });
  doc.stroke();

  points.forEach((point) => {
    doc.circle(point.x, point.y, 3).fill("#004aad");
    doc
      .fillColor("#001b44")
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(`${point.value}${suffix}`, point.x - 14, point.y - 14, {
        width: 28,
        align: "center",
      });
  });
}

function ensurePageSpace(doc, y, neededHeight) {
  if (y + neededHeight <= 760) return y;
  drawReportFooter(doc);
  doc.addPage();
  return 55;
}

function drawBadgeGrid(doc, badges, y) {
  let cursorY = ensurePageSpace(doc, y, 74);
  drawSectionTitle(doc, "", "BADGES EARNED THIS TERM", 55, cursorY, 485);
  cursorY += 42;

  if (badges.length === 0) {
    doc
      .roundedRect(55, cursorY - 8, 485, 40, 7)
      .fill("#f7faff")
      .strokeColor("#dbe5f5")
      .stroke();
    doc
      .fillColor("#4d5b73")
      .font("Helvetica")
      .fontSize(9)
      .text("No badges earned in this term yet.", 70, cursorY + 4);
    return cursorY + 52;
  }

  const cardWidth = 232;
  const cardHeight = 76;
  badges.forEach((badge, index) => {
    if (cursorY + cardHeight > 760) {
      drawReportFooter(doc);
      doc.addPage();
      cursorY = 55;
    }
    const column = index % 2;
    const x = column === 0 ? 55 : 308;
    const rowY = cursorY;
    doc
      .roundedRect(x, rowY, cardWidth, cardHeight, 8)
      .fill("#ffffff")
      .strokeColor("#dbe5f5")
      .stroke();
    doc.circle(x + 35, rowY + 34, 19).fill(badge.color || "#111827");
    doc
      .fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(
        (badge.label || "Badge").slice(0, 1).toUpperCase(),
        x + 25,
        rowY + 28,
        {
          width: 20,
          align: "center",
        }
      );
    doc
      .fillColor("#001b44")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(
        fitText(badge.badge_name || badge.label || "Badge", 28),
        x + 64,
        rowY + 14,
        {
          width: 150,
        }
      );
    doc
      .fillColor("#4d5b73")
      .font("Helvetica")
      .fontSize(7)
      .text(
        fitText(badge.subtitle || badge.detail || "", 34),
        x + 64,
        rowY + 30,
        {
          width: 150,
        }
      );
    doc
      .fillColor(badge.color || "#111827")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(
        String(badge.label || "Completion").toUpperCase(),
        x + 64,
        rowY + 50,
        {
          width: 150,
        }
      );
    if (column === 1 || index === badges.length - 1) {
      cursorY += cardHeight + 12;
    }
  });
  return cursorY + 4;
}

function drawCompetitionSection(doc, competitions, y) {
  let cursorY = ensurePageSpace(doc, y, 86);
  drawSectionTitle(doc, "", "COMPETITIONS", 55, cursorY, 485);
  cursorY += 40;

  if (competitions.length === 0) {
    doc
      .roundedRect(55, cursorY - 8, 485, 40, 7)
      .fill("#f7faff")
      .strokeColor("#dbe5f5")
      .stroke();
    doc
      .fillColor("#4d5b73")
      .font("Helvetica")
      .fontSize(9)
      .text("No competition results recorded for this term.", 70, cursorY + 4);
    return cursorY + 52;
  }

  doc.roundedRect(55, cursorY, 485, 24, 0).fill("#eef4ff");
  doc.fillColor("#003f91").font("Helvetica-Bold").fontSize(8);
  doc.text("Competition", 65, cursorY + 8);
  doc.text("Type", 255, cursorY + 8);
  doc.text("Score", 330, cursorY + 8);
  doc.text("Position", 410, cursorY + 8);
  cursorY += 34;

  competitions.forEach((competition, index) => {
    cursorY = ensurePageSpace(doc, cursorY, 36);
    doc
      .roundedRect(55, cursorY - 7, 485, 30, 4)
      .fill(index % 2 === 0 ? "#ffffff" : "#f7faff")
      .strokeColor("#dbe5f5")
      .stroke();
    doc.fillColor("#001b44").font("Helvetica").fontSize(8);
    doc.text(fitText(competition.competition_name, 34), 65, cursorY, {
      width: 178,
    });
    doc.text(
      String(competition.competition_type || "-").toUpperCase(),
      255,
      cursorY,
      {
        width: 62,
      }
    );
    doc.text(
      `${Number(competition.total_score || 0).toFixed(1)}`,
      330,
      cursorY,
      {
        width: 52,
      }
    );
    doc.text(
      competition.rank
        ? `${competition.rank}/${competition.participant_count || "-"}`
        : "-",
      410,
      cursorY,
      { width: 80 }
    );
    cursorY += 36;
  });

  return cursorY + 8;
}

async function getTypingTargets(term, academicYear) {
  const result = await query(
    `SELECT week_number, MAX(pass_threshold)::numeric AS pass_threshold
     FROM typing_tests
     WHERE test_type = 'weekly'
       AND term = $1
       AND academic_year = $2
     GROUP BY week_number`,
    [term, Number(academicYear)]
  );
  return new Map(
    result.rows.map((row) => [
      Number(row.week_number),
      Number(row.pass_threshold || 25),
    ])
  );
}

function average(values = []) {
  const valid = values
    .filter((value) => Number.isFinite(Number(value)))
    .map(Number);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function calculateOverallPerformance(
  weeklyMarks,
  courseProgress,
  typingTargets,
  settings = DEFAULT_REPORT_CARD_SETTINGS
) {
  const reportSettings = normalizeReportCardSettings(settings);
  const quizAverage = reportSettings.show_weekly_quizzes
    ? average(
        weeklyMarks
          .filter(
            (row) => row.quiz_score !== null && row.quiz_score !== undefined
          )
          .map((row) => row.quiz_score)
      )
    : null;
  const typingAverage = reportSettings.show_weekly_typing
    ? average(
        weeklyMarks
          .filter(
            (row) => row.typing_score !== null && row.typing_score !== undefined
          )
          .map((row) => {
            const target = typingTargets.get(Number(row.week_number)) || 25;
            return Math.min(
              100,
              (Number(row.typing_score) / Math.max(target, 1)) * 100
            );
          })
      )
    : null;
  const completedModuleScores = courseProgress.flatMap((course) =>
    (course.modules || [])
      .filter(
        (module) =>
          Number(module.total_activities || 0) > 0 &&
          Number(module.completed_activities || 0) >=
            Number(module.total_activities || 0)
      )
      .map((module) => module.score_percent)
  );
  const courseAverage = reportSettings.show_active_courses
    ? average(completedModuleScores)
    : null;
  const overall = average([quizAverage, typingAverage, courseAverage]);

  return {
    overall: overall === null ? 0 : Math.round(overall),
    quizAverage,
    typingAverage,
    courseAverage,
  };
}

function fitText(text, limit) {
  const value = String(text || "");
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function drawReportFooter(doc) {
  doc
    .fillColor("#4d5b73")
    .font("Helvetica-Oblique")
    .fontSize(7)
    .text(`Report generated on ${new Date().toDateString()}`, 55, 790, {
      width: 485,
      align: "center",
    });
}

async function isClosedReportPeriod(term, academicYear) {
  const result = await query(
    `SELECT t.end_date
     FROM terms t
     LEFT JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.name = $1
       AND ay.year = $2
     ORDER BY t.end_date DESC
     LIMIT 1`,
    [term, Number(academicYear)]
  );

  const endDate = result.rows[0]?.end_date;
  return endDate ? new Date(endDate) < new Date() : false;
}

async function getTermDateRange(term, academicYear) {
  const result = await query(
    `SELECT t.start_date, t.end_date
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.name = $1 AND ay.year = $2
     ORDER BY t.start_date DESC
     LIMIT 1`,
    [term, Number(academicYear)]
  );
  return result.rows[0] || null;
}

async function getTermBadges(learnerId, term, academicYear) {
  const range = await getTermDateRange(term, academicYear);
  const startDate = range?.start_date || `${Number(academicYear)}-01-01`;
  const endDate = range?.end_date || `${Number(academicYear)}-12-31`;

  const [moduleResult, typingResult] = await Promise.all([
    query(
      `SELECT b.*, c.name AS course_name, cm.title AS module_title
       FROM learner_module_badges b
       JOIN courses c ON c.id = b.course_id
       JOIN course_modules cm ON cm.id = b.module_id
       WHERE b.learner_id = $1
         AND b.awarded_at >= $2::date
         AND b.awarded_at < ($3::date + INTERVAL '1 day')
       ORDER BY COALESCE(b.updated_at, b.awarded_at) DESC`,
      [learnerId, startDate, endDate]
    ),
    query(
      `WITH lesson_totals AS (
         SELECT typing_test_id, COUNT(*)::integer AS lesson_count
         FROM typing_lessons
         GROUP BY typing_test_id
       ),
       completed_trials AS (
         SELECT ta.typing_test_id,
                ta.attempt_number,
                AVG(ta.final_score)::numeric AS net_wpm,
                AVG(ta.accuracy)::numeric AS accuracy,
                MAX(ta.submitted_at) AS awarded_at
         FROM typing_attempts ta
         JOIN lesson_totals lt ON lt.typing_test_id = ta.typing_test_id
         WHERE ta.learner_id = $1
           AND ta.submitted_at >= $2::date
           AND ta.submitted_at < ($3::date + INTERVAL '1 day')
         GROUP BY ta.typing_test_id, ta.attempt_number, lt.lesson_count
         HAVING COUNT(DISTINCT ta.typing_lesson_id) = lt.lesson_count
       ),
       ranked AS (
         SELECT *, ROW_NUMBER() OVER (
           PARTITION BY typing_test_id
           ORDER BY net_wpm DESC, accuracy DESC, attempt_number ASC
         ) AS \`rank\`
         FROM completed_trials
       )
       SELECT ranked.*, tt.name AS test_name
       FROM ranked
       JOIN typing_tests tt ON tt.id = ranked.typing_test_id
       WHERE ranked.\`rank\` = 1
       ORDER BY ranked.awarded_at DESC`,
      [learnerId, startDate, endDate]
    ),
  ]);

  const moduleBadges = moduleResult.rows.map((row) => ({
    ...row,
    badge_type: "module",
    badge_name: row.badge_name || row.module_title,
    subtitle: row.course_name,
    detail: row.module_title,
    awarded_at: row.updated_at || row.awarded_at,
    ...getBadgeTier(row.score_percent),
  }));
  const typingBadges = typingResult.rows.map((row) => {
    const badge = getTypingBadge(row.net_wpm, row.accuracy);
    return {
      id: `typing-${row.typing_test_id}`,
      badge_type: "typing",
      badge_name: row.test_name,
      subtitle: "Typing Practice",
      detail: `${Math.round(Number(row.net_wpm || 0))} WPM · ${Math.round(
        Number(row.accuracy || 0)
      )}% accuracy`,
      score_percent: Number(row.accuracy || 0),
      awarded_at: row.awarded_at,
      ...badge,
    };
  });
  return [...moduleBadges, ...typingBadges].sort(
    (left, right) =>
      new Date(right.awarded_at || 0) - new Date(left.awarded_at || 0)
  );
}

async function getLearnerCompetitionResults(learnerId, term, academicYear) {
  const range = await getTermDateRange(term, academicYear);
  if (!range?.start_date || !range?.end_date) return [];

  const result = await query(
    `WITH ranked AS (
       SELECT cr.learner_id,
              cr.competition_id,
              cr.result_stage,
              cr.learner_grade,
              cr.total_score,
              cr.quiz_score,
              cr.typing_wpm,
              cr.typing_accuracy,
              c.name AS competition_name,
              c.competition_type,
              c.start_date,
              c.end_date,
              RANK() OVER (
                PARTITION BY cr.competition_id, cr.result_stage, cr.learner_grade
                ORDER BY cr.total_score DESC NULLS LAST
              ) AS \`rank\`,
              COUNT(*) OVER (
                PARTITION BY cr.competition_id, cr.result_stage, cr.learner_grade
              )::integer AS participant_count
       FROM competition_results cr
       JOIN competitions c ON c.id = cr.competition_id
       WHERE cr.result_stage = 'final'
         AND c.start_date <= $3::date
         AND c.end_date >= $2::date
     )
     SELECT *
     FROM ranked
     WHERE learner_id = $1
     ORDER BY start_date DESC, competition_name`,
    [learnerId, range.start_date, range.end_date]
  );
  return result.rows;
}

async function hasReportPeriodData(learnerId, term, academicYear) {
  const result = await query(
    `SELECT
       EXISTS (
         SELECT 1
         FROM course_allocations
         WHERE learner_id = $1
           AND term = $2
           AND academic_year = $3
           AND status IN ('active', 'in_progress', 'completed')
       ) AS has_allocation,
       EXISTS (
         SELECT 1
         FROM weekly_marks
         WHERE learner_id = $1
           AND term = $2
           AND academic_year = $3
           AND (
             quiz_score IS NOT NULL
             OR typing_score IS NOT NULL
             OR active_course_score IS NOT NULL
           )
       ) AS has_weekly_marks,
       EXISTS (
         SELECT 1
         FROM progress_cache pc
         JOIN course_allocations a
           ON a.learner_id = pc.learner_id
          AND a.course_id = pc.course_id
          AND a.term = pc.term
          AND a.academic_year = pc.academic_year
         WHERE pc.learner_id = $1
           AND pc.term = $2
           AND pc.academic_year = $3
           AND a.status IN ('active', 'in_progress', 'completed')
       ) AS has_progress_cache`,
    [learnerId, term, Number(academicYear)]
  );

  return result.rows[0] || {};
}

async function getReportFeedback(learnerId, term, academicYear) {
  await ensureReportFeedbackTable();
  const result = await query(
    `SELECT rf.*, u.full_name AS updated_by_name
     FROM report_feedback rf
     LEFT JOIN users u ON u.id = rf.updated_by_user_id
     WHERE rf.learner_id = $1 AND rf.term = $2 AND rf.academic_year = $3
     LIMIT 1`,
    [learnerId, term, Number(academicYear)]
  );
  return result.rows[0] || null;
}

async function saveReportFeedback(
  user,
  learnerId,
  term,
  academicYear,
  commentText
) {
  await ensureReportFeedbackTable();
  const learnerResult = await query(
    "SELECT id, school_id, full_name FROM learners WHERE id = $1 LIMIT 1",
    [learnerId]
  );
  const learner = learnerResult.rows[0];

  if (!learner) {
    throw new Error("Learner not found.");
  }

  const normalizedComment = String(commentText || "").trim();
  if (!normalizedComment) {
    await query(
      "DELETE FROM report_feedback WHERE learner_id = $1 AND term = $2 AND academic_year = $3",
      [learnerId, term, Number(academicYear)]
    );
    return null;
  }

  const result = await query(
    `INSERT INTO report_feedback (
       learner_id, school_id, term, academic_year, comment_text, created_by_user_id, updated_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (learner_id, term, academic_year)
     DO UPDATE SET
       school_id = EXCLUDED.school_id,
       comment_text = EXCLUDED.comment_text,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      learnerId,
      learner.school_id,
      term,
      Number(academicYear),
      normalizedComment,
      user.userId,
    ]
  );

  return result.rows[0];
}

// Generate PDF report for a single learner
async function generateLearnerReportPDF(learnerId, term, academicYear) {
  const learnerResult = await query(
    `SELECT l.*, s.name as school_name, s.logo_url as school_logo, s.code as school_code
     FROM learners l
     JOIN schools s ON l.school_id = s.id
     WHERE l.id = $1`,
    [learnerId]
  );
  const learner = learnerResult.rows[0];

  if (!learner) {
    throw new Error("Learner not found");
  }

  const periodData = await hasReportPeriodData(learnerId, term, academicYear);
  if (!periodData.has_allocation) {
    const error = new Error(
      `No learning history found for ${learner.full_name} in ${academicYear} ${term}.`
    );
    error.statusCode = 404;
    throw error;
  }

  const reportSettings = await getReportCardSettings(learner.school_id);
  const useHistoricalCache = await isClosedReportPeriod(term, academicYear);
  const activeCourseProgress = reportSettings.show_active_courses
    ? await courseProgressService
        .getLearnerCourseProgress(learnerId, term, academicYear, {
          cachedOnly: useHistoricalCache,
          updateWeekly: !useHistoricalCache,
        })
        .catch((error) => {
          console.error(
            "Course progress sync for report failed:",
            error.message
          );
          return [];
        })
    : [];
  const needsWeeklyMarks =
    reportSettings.show_weekly_typing || reportSettings.show_weekly_quizzes;
  const weeklyMarks = needsWeeklyMarks
    ? await getWeeklyMarks(learnerId, term, academicYear)
    : [];
  const typingTargets = reportSettings.show_weekly_typing
    ? await getTypingTargets(term, academicYear)
    : new Map();
  const reportFeedback = reportSettings.show_teacher_feedback
    ? await getReportFeedback(learnerId, term, academicYear)
    : null;
  const termBadges = reportSettings.show_badges
    ? await getTermBadges(learnerId, term, academicYear)
    : [];
  const competitionResults = reportSettings.show_competitions
    ? await getLearnerCompetitionResults(learnerId, term, academicYear)
    : [];
  const performance = calculateOverallPerformance(
    weeklyMarks,
    activeCourseProgress,
    typingTargets,
    reportSettings
  );

  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const outputPath = path.join(
    __dirname,
    "../../uploads/reports",
    `report_${learnerId}_${term}_${academicYear}.pdf`
  );

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const output = fs.createWriteStream(outputPath);
  doc.pipe(output);

  const eduClubLogo = getEduClubLogoPath();
  if (eduClubLogo) {
    doc.image(eduClubLogo, 485, 46, { width: 42 });
  }

  if (learner.school_logo) {
    const localLogo = getUploadLocalPath(learner.school_logo);
    if (localLogo && fs.existsSync(localLogo)) {
      doc.image(localLogo, 55, 46, { width: 42 });
    } else {
      doc.circle(76, 67, 21).fill("#eef4ff");
      doc
        .fillColor("#003f91")
        .font("Helvetica-Bold")
        .fontSize(14)
        .text((learner.school_name || "S")[0].toUpperCase(), 64, 60, {
          width: 24,
          align: "center",
        });
    }
  } else {
    doc.circle(76, 67, 21).fill("#eef4ff");
    doc
      .fillColor("#003f91")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text((learner.school_name || "S")[0].toUpperCase(), 64, 60, {
        width: 24,
        align: "center",
      });
  }

  doc
    .fillColor("#003f91")
    .font("Helvetica-Bold")
    .fontSize(17)
    .text((learner.school_name || "School").toUpperCase(), 118, 54, {
      width: 360,
      align: "center",
    });
  doc
    .fillColor("#003f91")
    .fontSize(8)
    .text("COMPUTER CLUB", 118, 79, { width: 360, align: "center" });
  doc
    .fillColor("#001b44")
    .font("Helvetica")
    .fontSize(8)
    .text(`${academicYear} - ${term}`, 118, 91, {
      width: 360,
      align: "center",
    });
  doc
    .moveTo(55, 118)
    .lineTo(540, 118)
    .dash(4, { space: 4 })
    .strokeColor("#003f91")
    .lineWidth(1.4)
    .stroke()
    .undash();

  doc
    .roundedRect(55, 130, 485, 100, 8)
    .strokeColor("#cfd8e8")
    .lineWidth(1)
    .stroke();
  const infoY = 145;
  doc
    .fillColor("#4d5b73")
    .font("Helvetica")
    .fontSize(7)
    .text("Student Name", 70, infoY);
  doc
    .fillColor("#001b44")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(learner.full_name, 70, infoY + 10);
  doc
    .fillColor("#4d5b73")
    .font("Helvetica")
    .fontSize(7)
    .text("Class", 265, infoY);
  doc
    .fillColor("#001b44")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(
      `${learner.grade || "-"} - ${learner.stream || "-"}`,
      265,
      infoY + 10
    );
  doc
    .fillColor("#4d5b73")
    .font("Helvetica")
    .fontSize(7)
    .text("Member ID", 70, infoY + 42);
  doc
    .fillColor("#001b44")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(
      learner.username || learner.full_name || `Learner ${learner.id}`,
      70,
      infoY + 52
    );
  doc
    .fillColor("#4d5b73")
    .font("Helvetica")
    .fontSize(7)
    .text("Attendance", 265, infoY + 42);
  doc
    .fillColor("#001b44")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("-", 265, infoY + 52);

  const overall = performance.overall;
  doc
    .fillColor("#4d5b73")
    .font("Helvetica")
    .fontSize(7)
    .text("Overall Performance", 70, infoY + 70);
  drawPill(
    doc,
    `${getPerformanceLabel(overall).toUpperCase()} (${overall}%)`,
    70,
    infoY + 81,
    168,
    "#0b5fc7"
  );
  doc.circle(480, 166, 22).fill("#004aad");
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text((learner.full_name || "C")[0].toUpperCase(), 468, 158);
  doc
    .fillColor("#003f91")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      fitText(
        learner.full_name || learner.username || `Learner ${learner.id}`,
        18
      ),
      442,
      197,
      {
        width: 76,
        align: "center",
      }
    );
  doc
    .fillColor("#4d5b73")
    .font("Helvetica")
    .fontSize(7)
    .text(learner.grade || "-", 442, 210, { width: 76, align: "center" });

  let sectionNumber = 1;
  let moduleY = 246;
  const showBothWeeklyCharts =
    reportSettings.show_weekly_typing && reportSettings.show_weekly_quizzes;
  if (showBothWeeklyCharts) {
    drawSectionTitle(
      doc,
      String(sectionNumber++),
      "TYPING PERFORMANCE",
      55,
      moduleY,
      235
    );
    doc.roundedRect(55, moduleY, 235, 170, 7).strokeColor("#cfd8e8").stroke();
    drawLineChart(
      doc,
      weeklyMarks,
      "typing_score",
      68,
      moduleY + 40,
      200,
      105,
      ""
    );

    drawSectionTitle(
      doc,
      String(sectionNumber++),
      "QUIZ PERFORMANCE",
      305,
      moduleY,
      235
    );
    doc.roundedRect(305, moduleY, 235, 170, 7).strokeColor("#cfd8e8").stroke();
    drawLineChart(
      doc,
      weeklyMarks,
      "quiz_score",
      318,
      moduleY + 40,
      200,
      105,
      "%"
    );
    moduleY += 186;
  } else if (reportSettings.show_weekly_typing) {
    drawSectionTitle(
      doc,
      String(sectionNumber++),
      "TYPING PERFORMANCE",
      55,
      moduleY,
      485
    );
    doc.roundedRect(55, moduleY, 485, 170, 7).strokeColor("#cfd8e8").stroke();
    drawLineChart(
      doc,
      weeklyMarks,
      "typing_score",
      75,
      moduleY + 40,
      430,
      105,
      ""
    );
    moduleY += 186;
  } else if (reportSettings.show_weekly_quizzes) {
    drawSectionTitle(
      doc,
      String(sectionNumber++),
      "QUIZ PERFORMANCE",
      55,
      moduleY,
      485
    );
    doc.roundedRect(55, moduleY, 485, 170, 7).strokeColor("#cfd8e8").stroke();
    drawLineChart(
      doc,
      weeklyMarks,
      "quiz_score",
      75,
      moduleY + 40,
      430,
      105,
      "%"
    );
    moduleY += 186;
  }

  function drawCourseTableHeader(y, title, sectionNumber = "3") {
    drawSectionTitle(doc, sectionNumber, title, 55, y, 485);
    doc.roundedRect(55, y + 28, 485, 24, 0).fill("#eef4ff");
    doc.fillColor("#003f91").font("Helvetica-Bold").fontSize(8);
    doc.text("Module", 65, y + 37);
    doc.text("Progress", 326, y + 37);
    doc.text("Mark", 382, y + 37);
    doc.text("Performance", 433, y + 37);
    return y + 62;
  }

  if (reportSettings.show_active_courses && activeCourseProgress.length === 0) {
    moduleY = ensurePageSpace(doc, moduleY, 104);
    moduleY = drawCourseTableHeader(
      moduleY,
      "ACTIVE COURSES",
      String(sectionNumber++)
    );
    doc
      .fillColor("#4d5b73")
      .font("Helvetica")
      .fontSize(9)
      .text("No active course modules recorded for this term.", 65, moduleY, {
        width: 450,
      });
    moduleY += 34;
  } else if (reportSettings.show_active_courses) {
    activeCourseProgress.forEach((course) => {
      const title = `ACTIVE COURSE: ${String(
        course.course_name || "Course"
      ).toUpperCase()}`;
      if (moduleY + 70 > 760) {
        drawReportFooter(doc);
        doc.addPage();
        moduleY = 55;
      }
      moduleY = drawCourseTableHeader(moduleY, title, String(sectionNumber++));
      (course.modules || []).forEach((module, moduleIndex) => {
        const moduleName = `${module.module_number}. ${module.name}`;
        const textHeight = doc.heightOfString(moduleName, { width: 245 });
        const rowHeight = Math.max(34, textHeight + 14);
        if (moduleY + rowHeight > 760) {
          drawReportFooter(doc);
          doc.addPage();
          moduleY = drawCourseTableHeader(
            55,
            `${String(course.course_name || "Course").toUpperCase()} CONTINUED`,
            ""
          );
        }
        doc
          .roundedRect(55, moduleY - 7, 485, rowHeight, 4)
          .fill(moduleIndex % 2 === 0 ? "#ffffff" : "#f7faff");
        doc
          .roundedRect(55, moduleY - 7, 485, rowHeight, 4)
          .strokeColor("#dbe5f5")
          .stroke();
        doc
          .fillColor("#001b44")
          .font("Helvetica")
          .fontSize(8)
          .text(moduleName, 65, moduleY, { width: 245 });
        doc.text(`${module.progress_percent}%`, 329, moduleY, { width: 42 });
        doc.text(`${module.score_percent}%`, 385, moduleY, { width: 38 });
        drawPill(
          doc,
          getPerformanceLabel(module.score_percent).toUpperCase(),
          426,
          moduleY - 2,
          104,
          getPerformanceLabel(module.score_percent) === "Approaching"
            ? "#f59e0b"
            : "#0b5fc7"
        );
        moduleY += rowHeight + 6;
      });
      moduleY += 14;
    });
  }

  if (reportSettings.show_badges) {
    moduleY = drawBadgeGrid(doc, termBadges, moduleY + 6);
  }

  if (reportSettings.show_competitions) {
    moduleY = drawCompetitionSection(doc, competitionResults, moduleY + 6);
  }

  if (reportFeedback?.comment_text) {
    const feedbackHeight = Math.max(
      82,
      doc.heightOfString(reportFeedback.comment_text, {
        width: 455,
        align: "left",
      }) + 50
    );
    if (moduleY + feedbackHeight + 24 > 760) {
      drawReportFooter(doc);
      doc.addPage();
      moduleY = 55;
    }

    doc.roundedRect(55, moduleY + 14, 485, feedbackHeight, 7).fill("#eef4ff");
    doc
      .fillColor("#003f91")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("TEACHER'S FEEDBACK", 65, moduleY + 27);
    doc
      .fillColor("#001b44")
      .font("Helvetica")
      .fontSize(8)
      .text(reportFeedback.comment_text, 65, moduleY + 46, {
        width: 455,
        align: "left",
      });
    if (reportFeedback.updated_by_name) {
      doc
        .fillColor("#31557d")
        .font("Helvetica-Oblique")
        .fontSize(7.5)
        .text(
          `Feedback by ${reportFeedback.updated_by_name}`,
          65,
          moduleY + feedbackHeight - 2,
          {
            width: 455,
            align: "right",
          }
        );
    }
  }
  drawReportFooter(doc);

  return new Promise((resolve, reject) => {
    output.on("finish", () => resolve(outputPath));
    output.on("error", reject);
    doc.on("error", reject);
    doc.end();
  });
}

// Generate PDF reports for multiple learners (class or school)
async function generateMultipleReportsPDF(learnerIds, term, academicYear) {
  const zipPath = path.join(
    __dirname,
    "../../uploads/reports",
    `reports_${term}_${academicYear}.zip`
  );
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.pipe(output);

  for (const learnerId of learnerIds) {
    try {
      const pdfPath = await generateLearnerReportPDF(
        learnerId,
        term,
        academicYear
      );
      const fileName = path.basename(pdfPath);
      archive.file(pdfPath, { name: fileName });
    } catch (error) {
      console.error(
        `Failed to generate report for learner ${learnerId}:`,
        error.message
      );
    }
  }

  await archive.finalize();

  return new Promise((resolve, reject) => {
    output.on("close", () => resolve(zipPath));
    output.on("error", reject);
  });
}

module.exports = {
  getAllReports,
  getLearnerReports,
  getSchoolReports,
  getCourseReports,
  generateReport,
  getWeeklyMarks,
  getWeeklyMarksForLearners,
  getReportFeedback,
  saveReportFeedback,
  getReportCardSettings,
  saveReportCardSettings,
  normalizeReportCardSettings,
  getTermBadges,
  drawBadgeGrid,
  getLearnerCompetitionResults,
  generateLearnerReportPDF,
  generateMultipleReportsPDF,
  getPerformanceLabel,
  getEduClubLogoPath,
};

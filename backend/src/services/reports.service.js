const { query } = require("../config");
const PDFDocument = require("pdfkit");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const courseProgressService = require("./courseProgress.service");

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
    `SELECT * FROM weekly_marks 
     WHERE learner_id = $1 AND term = $2 AND academic_year = $3 
     ORDER BY week_number`,
    [learnerId, term, academicYear]
  );
  return result.rows;
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
    .text(`${number}. ${title}`, x + 10, y + 9);
}

function drawLineChart(doc, rows, key, x, y, width, height, suffix = "") {
  const data = rows
    .map((row) => ({ week: row.week_number, value: Number(row[key]) }))
    .filter((row) => !Number.isNaN(row.value));

  doc.strokeColor("#c6ccd8").lineWidth(1);
  doc
    .moveTo(x + 35, y + 18)
    .lineTo(x + 35, y + height - 25)
    .lineTo(x + width - 20, y + height - 25)
    .stroke();

  if (data.length === 0) {
    doc
      .fillColor("#4d5b73")
      .font("Helvetica")
      .fontSize(9)
      .text("No data yet.", x + 45, y + 50);
    return;
  }

  const plotLeft = x + 35;
  const plotRight = x + width - 28;
  const plotTop = y + 18;
  const plotBottom = y + height - 25;
  const max = Math.max(100, ...data.map((item) => item.value));
  const step =
    data.length === 1 ? 0 : (plotRight - plotLeft) / (data.length - 1);
  const points = data.map((item, index) => ({
    x: data.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + index * step,
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
    doc
      .fillColor("#001b44")
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(`Week ${point.week}`, point.x - 18, plotBottom + 7, {
        width: 36,
        align: "center",
      });
  });
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

async function saveReportFeedback(user, learnerId, term, academicYear, commentText) {
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

  const useHistoricalCache = await isClosedReportPeriod(term, academicYear);
  const activeCourseProgress = await courseProgressService
    .getLearnerCourseProgress(learnerId, term, academicYear, {
      cachedOnly: useHistoricalCache,
      updateWeekly: !useHistoricalCache,
    })
    .catch((error) => {
      console.error("Course progress sync for report failed:", error.message);
      return [];
    });
  const weeklyMarks = await getWeeklyMarks(learnerId, term, academicYear);
  const reportFeedback = await getReportFeedback(learnerId, term, academicYear);
  const allocationsResult = await query(
    `SELECT c.name AS course_name
     FROM course_allocations a
     JOIN courses c ON c.id = a.course_id
     WHERE a.learner_id = $1
       AND a.term = $2
       AND a.academic_year = $3
       AND a.status IN ('active', 'in_progress', 'completed')
       AND COALESCE(c.course_category, 'general') = 'general'
     ORDER BY a.allocated_at DESC
     LIMIT 1`,
    [learnerId, term, Number(academicYear)]
  );
  const activeCourse =
    activeCourseProgress[0]?.course_name ||
    allocationsResult.rows[0]?.course_name ||
    "Active Course";

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
    if (fs.existsSync(localLogo)) {
      doc.image(localLogo, 55, 46, { width: 42 });
    }
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

  const overall = weeklyMarks.length
    ? Math.round(
        weeklyMarks.reduce(
          (sum, row) =>
            sum +
            Number(row.quiz_score || 0) +
            Number(row.typing_score || 0) +
            Number(row.active_course_score || 0),
          0
        ) /
          (weeklyMarks.length * 3)
      )
    : 0;
  doc
    .fillColor("#4d5b73")
    .font("Helvetica")
    .fontSize(7)
    .text("Overall Performance", 70, infoY + 70);
  drawPill(
    doc,
    getPerformanceLabel(overall).toUpperCase(),
    70,
    infoY + 81,
    138,
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

  drawSectionTitle(doc, "1", "TYPING PERFORMANCE", 55, 246, 235);
  doc.roundedRect(55, 246, 235, 170, 7).strokeColor("#cfd8e8").stroke();
  drawLineChart(doc, weeklyMarks, "typing_score", 68, 286, 200, 105, "");

  drawSectionTitle(doc, "2", "QUIZ PERFORMANCE", 305, 246, 235);
  doc.roundedRect(305, 246, 235, 170, 7).strokeColor("#cfd8e8").stroke();
  drawLineChart(doc, weeklyMarks, "quiz_score", 318, 286, 200, 105, "%");

  const latest = weeklyMarks[weeklyMarks.length - 1] || {};
  const courseModules = activeCourseProgress[0]?.modules || [];
  const modules =
    courseModules.length > 0
      ? courseModules.map((module) => ({
          name: `${module.module_number}. ${module.name}`,
          progress: `${module.progress_percent}%`,
          mark:
            module.score_percent !== null && module.score_percent !== undefined
              ? `${module.score_percent}%`
              : "-",
          performance: module.grade_label.toUpperCase(),
        }))
      : [
          {
            name: `1. ${fitText(activeCourse, 28)}`,
            progress: `${latest.active_course_score || overall || 0}%`,
            mark: latest.active_course_score
              ? `${latest.active_course_score}%`
              : "-",
            performance: getPerformanceLabel(
              latest.active_course_score || overall
            ).toUpperCase(),
          },
          {
            name: "2. Weekly learning activities",
            progress: `${latest.quiz_score || overall || 0}%`,
            mark: latest.quiz_score ? `${latest.quiz_score}%` : "-",
            performance: getPerformanceLabel(
              latest.quiz_score || overall
            ).toUpperCase(),
          },
        ];

  function drawCourseTableHeader(
    y,
    title = `ACTIVE COURSE: ${activeCourse.toUpperCase()}`
  ) {
    drawSectionTitle(doc, "3", title, 55, y, 485);
    doc.roundedRect(55, y + 28, 485, 24, 0).fill("#eef4ff");
    doc.fillColor("#003f91").font("Helvetica-Bold").fontSize(8);
    doc.text("Module", 65, y + 37);
    doc.text("Progress", 305, y + 37);
    doc.text("Mark", 365, y + 37);
    doc.text("Performance", 435, y + 37);
    return y + 62;
  }

  let moduleY = drawCourseTableHeader(432);
  modules.forEach((module, index) => {
    if (moduleY + 38 > 760) {
      drawReportFooter(doc);
      doc.addPage();
      moduleY = drawCourseTableHeader(55, "ACTIVE COURSE CONTINUED");
    }
    doc
      .roundedRect(55, moduleY - 7, 485, 34, 4)
      .fill(index % 2 === 0 ? "#ffffff" : "#f7faff");
    doc
      .roundedRect(55, moduleY - 7, 485, 34, 4)
      .strokeColor("#dbe5f5")
      .stroke();
    doc
      .fillColor("#001b44")
      .font("Helvetica")
      .fontSize(8)
      .text(module.name, 65, moduleY, { width: 220, height: 20 });
    doc.text(module.progress, 307, moduleY, { width: 45 });
    doc.text(module.mark, 367, moduleY, { width: 45 });
    drawPill(
      doc,
      module.performance,
      430,
      moduleY - 2,
      96,
      module.performance === "APPROACHING" ? "#f59e0b" : "#0b5fc7"
    );
    moduleY += 40;
  });

  if (reportFeedback?.comment_text) {
    const feedbackHeight = Math.max(
      68,
      doc.heightOfString(reportFeedback.comment_text, {
        width: 455,
        align: "left",
      }) + 36
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

// Simple bar chart drawing function for PDF
function drawBarChart(doc, data, x, y, width, height, title) {
  if (data.length === 0) {
    doc
      .fontSize(10)
      .fillColor("black")
      .text(`No ${title} data available.`, x, y);
    return;
  }

  const barWidth = width / data.length - 10;
  const maxHeight = height - 30;

  // Draw axes
  doc
    .moveTo(x, y)
    .lineTo(x, y + height)
    .lineTo(x + width, y + height)
    .stroke();

  data.forEach((item, index) => {
    const barHeight = (item.score / 100) * maxHeight;
    const barX = x + index * (barWidth + 10) + 5;
    const barY = y + height - barHeight;

    // Draw bar
    doc.rect(barX, barY, barWidth, barHeight).fillAndStroke("#4CAF50");

    // Draw score label
    doc
      .fontSize(10)
      .fillColor("black")
      .text(`${item.score}%`, barX + barWidth / 2 - 10, barY - 15);

    // Draw week label
    doc.text(`W${item.week}`, barX + barWidth / 2 - 5, y + height + 10);
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
  generateLearnerReportPDF,
  generateMultipleReportsPDF,
  getPerformanceLabel,
  getEduClubLogoPath,
};

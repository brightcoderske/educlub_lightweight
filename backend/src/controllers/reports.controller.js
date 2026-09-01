const { query } = require("../config");
const reportsService = require("../services/reports.service");
const academicService = require("../services/academic.service");
const teacherAssignmentsService = require("../services/teacherAssignments.service");

async function ensureLearnerAccess(req, learnerId) {
  if (req.user.role === "system_admin") {
    return true;
  }

  const result = await query(
    "SELECT school_id, user_id FROM learners WHERE id = $1",
    [learnerId]
  );
  const learner = result.rows[0];

  if (!learner) {
    return false;
  }

  if (req.user.role === "school_admin") {
    return Number(learner.school_id) === Number(req.user.schoolId);
  }
  if (req.user.role === "teacher") {
    if (Number(learner.school_id) !== Number(req.user.schoolId)) return false;
    try {
      await teacherAssignmentsService.assertTeacherLearnerAccess(
        req.user,
        learnerId
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  return Number(learner.user_id) === Number(req.user.userId);
}

async function getAllReports(req, res) {
  try {
    const result = await query(
      `SELECT r.*
       FROM reports r
       JOIN learners l ON r.learner_id = l.id
       WHERE $1 = 'system_admin'
          OR ($1 = 'school_admin' AND l.school_id = $2)
          OR ($1 = 'teacher' AND l.school_id = $2 AND EXISTS (
            SELECT 1
            FROM course_allocations ca
            JOIN course_teacher_assignments cta ON cta.course_id = ca.course_id
            WHERE ca.learner_id = l.id
              AND cta.teacher_user_id = $3
              AND cta.is_active = true
          ))
          OR ($1 = 'learner' AND l.user_id = $3)
       ORDER BY r.created_at DESC`,
      [req.user.role, req.user.schoolId, req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ error: "Failed to get reports" });
  }
}

async function getLearnerReports(req, res) {
  try {
    const allowed = await ensureLearnerAccess(req, req.params.learnerId);
    if (!allowed) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    const result = await query(
      `SELECT r.*, l.full_name as learner_name, c.name as course_name
       FROM reports r
       JOIN learners l ON r.learner_id = l.id
       LEFT JOIN courses c ON r.course_id = c.id
       WHERE r.learner_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.learnerId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get learner reports error:", error);
    res.status(500).json({ error: "Failed to get learner reports" });
  }
}

async function getSchoolReports(req, res) {
  try {
    if (
      req.user.role === "school_admin" &&
      Number(req.params.schoolId) !== Number(req.user.schoolId)
    ) {
      return res.status(403).json({ error: "School is outside your access" });
    }

    const result = await query(
      `SELECT r.*, l.full_name as learner_name, s.name as school_name, c.name as course_name
       FROM reports r
       JOIN learners l ON r.learner_id = l.id
       JOIN schools s ON l.school_id = s.id
       LEFT JOIN courses c ON r.course_id = c.id
       WHERE l.school_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.schoolId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get school reports error:", error);
    res.status(500).json({ error: "Failed to get school reports" });
  }
}

async function getCourseReports(req, res) {
  try {
    // This route had no role guard and no school check, so any signed-in
    // account - including a learner - could read every learner's report for
    // any course id by walking the ids.
    if (req.user.role === "learner") {
      return res.status(403).json({ error: "Course reports are staff only" });
    }

    if (req.user.role !== "system_admin") {
      const courseResult = await query(
        "SELECT school_id FROM courses WHERE id = $1",
        [req.params.courseId]
      );
      const course = courseResult.rows[0];
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      if (Number(course.school_id) !== Number(req.user.schoolId)) {
        return res.status(403).json({ error: "Course is outside your access" });
      }
    }

    if (req.user.role === "teacher") {
      await teacherAssignmentsService.assertTeacherCourseAccess(
        req.user,
        req.params.courseId
      );
    }
    const result = await query(
      `SELECT r.*, l.full_name as learner_name, c.name as course_name
       FROM reports r
       JOIN learners l ON r.learner_id = l.id
       JOIN courses c ON r.course_id = c.id
       WHERE r.course_id = $1
         AND ($2::integer IS NULL OR l.school_id = $2::integer)
       ORDER BY r.created_at DESC`,
      [
        req.params.courseId,
        req.user.role === "system_admin" ? null : Number(req.user.schoolId),
      ]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get course reports error:", error);
    res.status(500).json({ error: "Failed to get course reports" });
  }
}

async function generateReport(req, res) {
  try {
    const { learner_id, course_id, report_type, term, academic_year, data } =
      req.body;

    const allowed = await ensureLearnerAccess(req, learner_id);
    if (!allowed || req.user.role === "learner") {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

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

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
}

async function getReportFeedback(req, res) {
  try {
    const { learnerId } = req.params;
    const { term, academicYear } = req.query;
    const allowed = await ensureLearnerAccess(req, learnerId);
    if (!allowed || req.user.role === "learner") {
      return res.status(403).json({ error: "Learner is outside your access" });
    }
    if (!term || !academicYear) {
      return res
        .status(400)
        .json({ error: "Term and academic year are required." });
    }

    const feedback = await reportsService.getReportFeedback(
      learnerId,
      term,
      academicYear
    );
    res.json(
      feedback || {
        learner_id: Number(learnerId),
        term,
        academic_year: Number(academicYear),
        comment_text: "",
      }
    );
  } catch (error) {
    console.error("Get report feedback error:", error);
    res.status(500).json({ error: "Failed to load report feedback" });
  }
}

async function saveReportFeedback(req, res) {
  try {
    const { learnerId } = req.params;
    const { term, academicYear, comment_text } = req.body;
    const allowed = await ensureLearnerAccess(req, learnerId);
    if (!allowed || req.user.role === "learner") {
      return res.status(403).json({ error: "Learner is outside your access" });
    }
    if (!term || !academicYear) {
      return res
        .status(400)
        .json({ error: "Term and academic year are required." });
    }

    const saved = await reportsService.saveReportFeedback(
      req.user,
      learnerId,
      term,
      academicYear,
      comment_text
    );
    res.json(
      saved || {
        learner_id: Number(learnerId),
        term,
        academic_year: Number(academicYear),
        comment_text: "",
        message: "Feedback cleared.",
      }
    );
  } catch (error) {
    console.error("Save report feedback error:", error);
    res.status(500).json({ error: "Failed to save report feedback" });
  }
}

function resolveSettingsSchoolId(req) {
  return req.user.role === "system_admin"
    ? req.query.school_id || req.body?.school_id
    : req.user.schoolId;
}

async function getReportCardSettings(req, res) {
  try {
    const schoolId = resolveSettingsSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ error: "School is required" });
    }
    const settings = await reportsService.getReportCardSettings(schoolId);
    res.json(settings);
  } catch (error) {
    console.error("Get report card settings error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function saveReportCardSettings(req, res) {
  try {
    const schoolId = resolveSettingsSchoolId(req);
    const settings = await reportsService.saveReportCardSettings(
      req.user,
      schoolId,
      req.body.settings || req.body
    );
    res.json(settings);
  } catch (error) {
    console.error("Save report card settings error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function generateLearnerReportPDF(req, res) {
  try {
    let { learnerId, term, academicYear } = req.params;
    const { term_type } = req.query;
    const allowed = await ensureLearnerAccess(req, learnerId);
    if (!allowed) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear ||
          activeTerm.academic_year ||
          new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    const pdfPath = await reportsService.generateLearnerReportPDF(
      learnerId,
      term,
      academicYear
    );

    res.download(pdfPath, `report_${learnerId}_${term}_${academicYear}.pdf`);
  } catch (error) {
    console.error("Generate learner PDF report error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function generateClassReportsPDF(req, res) {
  try {
    let { grade, stream, term, academicYear, school_id } = req.body;
    const { term_type } = req.body;
    const schoolId =
      req.user.role === "system_admin" ? school_id : req.user.schoolId;

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear ||
          activeTerm.academic_year ||
          new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    // Get all learners in this class
    const learnersResult = await query(
      `SELECT id FROM learners 
       WHERE school_id = $1 AND grade = $2 AND stream = $3 AND is_active = true`,
      [schoolId, grade, stream]
    );

    const learnerIds = learnersResult.rows.map((l) => l.id);

    if (learnerIds.length === 0) {
      return res.status(404).json({ error: "No learners found in this class" });
    }

    const zipPath = await reportsService.generateMultipleReportsPDF(
      learnerIds,
      term,
      academicYear
    );

    res.download(
      zipPath,
      `reports_${grade}_${stream}_${term}_${academicYear}.zip`
    );
  } catch (error) {
    console.error("Generate class PDF reports error:", error);
    res.status(500).json({ error: error.message });
  }
}

async function generateSchoolReportsPDF(req, res) {
  try {
    let { term, academicYear, school_id } = req.body;
    const { term_type } = req.body;
    const schoolId =
      req.user.role === "system_admin" ? school_id : req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: "School is required" });
    }

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear ||
          activeTerm.academic_year ||
          new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    // Get all learners in this school
    const learnersResult = await query(
      `SELECT id FROM learners WHERE school_id = $1 AND is_active = true`,
      [schoolId]
    );

    const learnerIds = learnersResult.rows.map((l) => l.id);

    if (learnerIds.length === 0) {
      return res
        .status(404)
        .json({ error: "No learners found in this school" });
    }

    const zipPath = await reportsService.generateMultipleReportsPDF(
      learnerIds,
      term,
      academicYear
    );

    res.download(zipPath, `reports_school_${term}_${academicYear}.zip`);
  } catch (error) {
    console.error("Generate school PDF reports error:", error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAllReports,
  getLearnerReports,
  getSchoolReports,
  getCourseReports,
  generateReport,
  getReportFeedback,
  saveReportFeedback,
  getReportCardSettings,
  saveReportCardSettings,
  generateLearnerReportPDF,
  generateClassReportsPDF,
  generateSchoolReportsPDF,
};

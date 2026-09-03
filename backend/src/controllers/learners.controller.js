const { query } = require("../config");
const learnersService = require("../services/learners.service");
const notificationsService = require("../services/notifications.service");
const env = require("../config/env");
const authService = require("../services/auth.service");
const { resolveLearnerSchoolScope } = require("../services/learnerScope");
const { generateRandomPassword, hashPassword } = require("../utils/password");
const teacherAssignmentsService = require("../services/teacherAssignments.service");
const academicService = require("../services/academic.service");
const { normalizeGrade } = require("../utils/grade");
const streakService = require("../services/streak.service");
const { getSchoolPopulation } = require("../services/schoolPopulation.service");

function canManageLearner(user, learner) {
  if (user.role === "system_admin") {
    return true;
  }

  if (user.role === "school_admin") {
    return Number(learner.school_id) === Number(user.schoolId);
  }

  return Number(learner.user_id) === Number(user.userId);
}

async function getAllLearners(req, res) {
  try {
    const { school_id, grade, term, academic_year, email } = req.query;

    let queryText = `
      SELECT l.*, s.name as school_name, u.username
      FROM learners l
      JOIN schools s ON l.school_id = s.id
      LEFT JOIN users u ON u.id = l.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    const scopedSchoolId = resolveLearnerSchoolScope(req.user, school_id);

    if (scopedSchoolId) {
      queryText += ` AND l.school_id = $${paramIndex}`;
      params.push(scopedSchoolId);
      paramIndex++;
      if (
        req.user.role === "teacher" &&
        req.query.scope !== "allocation_picker"
      ) {
        queryText += ` AND EXISTS (
          SELECT 1
          FROM course_allocations ca
          JOIN course_teacher_assignments cta ON cta.course_id = ca.course_id
          WHERE ca.learner_id = l.id
            AND cta.teacher_user_id = $${paramIndex}
            AND cta.is_active = true
        )`;
        params.push(req.user.userId);
        paramIndex++;
      }
    } else if (req.user.role === "learner") {
      queryText += ` AND l.user_id = $${paramIndex}`;
      params.push(req.user.userId);
      paramIndex++;
    }

    if (grade) {
      queryText += ` AND l.grade = $${paramIndex}`;
      params.push(grade);
      paramIndex++;
    }

    if (term) {
      queryText += ` AND l.term = $${paramIndex}`;
      params.push(term);
      paramIndex++;
    }

    if (academic_year) {
      queryText += ` AND l.academic_year = $${paramIndex}`;
      params.push(academic_year);
      paramIndex++;
    }

    if (email) {
      queryText += ` AND LOWER(l.email) = LOWER($${paramIndex})`;
      params.push(email);
      paramIndex++;
    }

    queryText += " ORDER BY l.full_name";

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get learners error:", error);
    res.status(500).json({ error: "Failed to get learners" });
  }
}

async function createLearner(req, res) {
  try {
    const {
      first_name,
      second_name,
      third_name,
      email,
      grade,
      term,
      academic_year,
      stream,
    } = req.body;
    const schoolId =
      req.user.role === "school_admin" ? req.user.schoolId : req.body.school_id;
    const fullName =
      req.body.full_name ||
      [first_name, second_name, third_name].filter(Boolean).join(" ").trim();

    if (!schoolId) {
      return res.status(400).json({ error: "School is required" });
    }

    if (!fullName || !first_name || !second_name) {
      return res
        .status(400)
        .json({ error: "First name and second name are required" });
    }

    // Never store a term the operator did not create. With no term supplied
    // this resolves to the active one instead of a client-side default.
    let resolvedTerm;
    try {
      resolvedTerm = await academicService.resolveTerm(term, academic_year);
    } catch (termError) {
      return res.status(400).json({ error: termError.message });
    }

    const result = await learnersService.createLearner({
      school_id: schoolId,
      full_name: fullName,
      email,
      grade: normalizeGrade(grade),
      term: resolvedTerm.term,
      academic_year: resolvedTerm.academic_year,
      stream,
    });

    await notificationsService.notifyRole("system_admin", {
      title: "New learner registered",
      message: `${fullName} was registered under school ID ${schoolId}.`,
      notification_type: "learner_registered",
      entity_type: "learner",
      entity_id: result.learner.id,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Create learner error:", error);
    res.status(500).json({ error: "Failed to create learner" });
  }
}

async function bulkCreateLearners(req, res) {
  try {
    const { school_id, learners } = req.body;
    const schoolId =
      req.user.role === "school_admin" ? req.user.schoolId : school_id;

    if (!schoolId) {
      return res
        .status(400)
        .json({ error: "Choose the school before uploading learners." });
    }

    if (!Array.isArray(learners) || learners.length === 0) {
      return res.status(400).json({
        error:
          "No learners found. Upload a CSV or Excel file with first_name and second_name columns.",
      });
    }

    const created = [];
    const errors = [];

    for (const [index, row] of learners.entries()) {
      const rowNumber = index + 2;
      const firstName = row.first_name || row.firstName || row["1st name"];
      const secondName = row.second_name || row.secondName || row["2nd name"];
      const thirdName = row.third_name || row.thirdName || row["3rd name"];

      if (!firstName || !secondName) {
        errors.push({
          row: rowNumber,
          message: "First name and second name are required.",
        });
        continue;
      }

      let rowTerm;
      try {
        // Same rule as single create: a spreadsheet cannot introduce a term
        // that no operator created.
        rowTerm = await academicService.resolveTerm(
          row.term || null,
          row.academic_year || row.academicYear || null,
        );
      } catch (termError) {
        errors.push({ row: rowNumber, message: termError.message });
        continue;
      }

      try {
        const result = await learnersService.createLearner({
          school_id: schoolId,
          full_name: [firstName, secondName, thirdName]
            .filter(Boolean)
            .join(" "),
          grade: normalizeGrade(row.grade),
          stream: row.stream || null,
          term: rowTerm.term,
          academic_year: rowTerm.academic_year,
        });
        created.push(result);
      } catch (error) {
        errors.push({
          row: rowNumber,
          message:
            "Could not create learner. Check for duplicate names or invalid data.",
        });
      }
    }

    if (errors.length > 0 && created.length === 0) {
      return res.status(400).json({
        error:
          "No learners were imported. Fix the listed rows and upload again.",
        details: errors,
      });
    }

    res.status(201).json({
      message: `Imported ${created.length} learners.`,
      learners: created,
      errors,
    });
  } catch (error) {
    console.error("Bulk create learners error:", error);
    res.status(500).json({ error: "Failed to import learners" });
  }
}

async function getLearnerById(req, res) {
  try {
    const result = await query(
      `SELECT l.*, u.username
       FROM learners l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.id = $1`,
      [req.params.id]
    );
    const learner = result.rows[0];

    if (!learner) {
      return res.status(404).json({ error: "Learner not found" });
    }

    if (!canManageLearner(req.user, learner)) {
      if (req.user.role !== "teacher") {
        return res
          .status(403)
          .json({ error: "Learner is outside your access" });
      }
      await teacherAssignmentsService.assertTeacherLearnerAccess(
        req.user,
        learner.id
      );
    }

    res.json(learner);
  } catch (error) {
    console.error("Get learner error:", error);
    res.status(500).json({ error: "Failed to get learner" });
  }
}

async function getPopulation(req, res) {
  try {
    // A system administrator can ask about any school; everyone else is pinned
    // to their own, so the query parameter cannot be used to read across a
    // tenant boundary.
    const schoolId =
      req.user.role === "system_admin"
        ? req.query.school_id || req.user.schoolId
        : req.user.schoolId;

    if (!schoolId) {
      return res.json([]);
    }

    res.json(await getSchoolPopulation(schoolId));
  } catch (error) {
    console.error("Get school population error:", error);
    res.status(500).json({ error: "Failed to load school population" });
  }
}

async function getLearnerStreak(req, res) {
  try {
    const result = await query("SELECT * FROM learners WHERE id = $1", [
      req.params.id,
    ]);
    const learner = result.rows[0];

    if (!learner) {
      return res.status(404).json({ error: "Learner not found" });
    }

    if (!canManageLearner(req.user, learner)) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    res.json(await streakService.getLearnerStreak(learner.id));
  } catch (error) {
    console.error("Get learner streak error:", error);
    res.status(500).json({ error: "Failed to load streak" });
  }
}

async function updateLearner(req, res) {
  try {
    const {
      school_id,
      full_name,
      email,
      grade,
      term,
      academic_year,
      stream,
      next_grade,
      next_term,
    } = req.body;

    const existingResult = await query("SELECT * FROM learners WHERE id = $1", [
      req.params.id,
    ]);
    const existingLearner = existingResult.rows[0];

    if (!existingLearner) {
      return res.status(404).json({ error: "Learner not found" });
    }

    if (!canManageLearner(req.user, existingLearner)) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    const nextSchoolId =
      req.user.role === "system_admin"
        ? school_id || existingLearner.school_id
        : existingLearner.school_id;
    const nextFullName =
      req.user.role === "learner"
        ? existingLearner.full_name
        : full_name || existingLearner.full_name;

    // A learner owns exactly one field on their own record: the grade they are
    // in. Stream, term, academic year and email are placement data an operator
    // sets - they drive allocations, report cards and promotion, so a child
    // typing into them would silently move themselves out of their own class.
    // The profile screen renders those read-only; this is what makes that true
    // rather than decorative.
    const selfEdit = req.user.role === "learner";
    let nextGrade = existingLearner.grade;

    if (grade !== undefined) {
      nextGrade = normalizeGrade(grade);
      if (selfEdit && !nextGrade) {
        return res
          .status(400)
          .json({ error: "Choose a grade between Grade 1 and Grade 12." });
      }
    }

    const result = await query(
      `UPDATE learners
       SET school_id = $1, full_name = $2, email = $3, grade = $4, term = $5,
           academic_year = $6, stream = $7, next_grade = $8, next_term = $9
       WHERE id = $10
       RETURNING *`,
      [
        nextSchoolId,
        nextFullName,
        !selfEdit && email !== undefined ? email : existingLearner.email,
        nextGrade,
        !selfEdit && term !== undefined ? term : existingLearner.term,
        !selfEdit && academic_year !== undefined
          ? academic_year
          : existingLearner.academic_year,
        !selfEdit && stream !== undefined ? stream : existingLearner.stream,
        selfEdit ? existingLearner.next_grade : normalizeGrade(next_grade),
        selfEdit ? existingLearner.next_term : next_term,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Learner not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update learner error:", error);
    res.status(500).json({ error: "Failed to update learner" });
  }
}

async function promoteLearners(req, res) {
  try {
    const {
      school_id,
      learner_ids,
      grade,
      stream,
      next_grade,
      next_term,
      academic_year,
    } = req.body;
    const schoolId =
      req.user.role === "school_admin" ? req.user.schoolId : school_id;

    if (!schoolId) {
      return res.status(400).json({ error: "School is required" });
    }

    if (!next_grade && !next_term) {
      return res
        .status(400)
        .json({ error: "Next grade or next term is required" });
    }

    // Promotion moves learners into a term, so that term must be one an
    // operator created. Without this a caller can write any string onto the
    // whole cohort at once, which is the widest-blast-radius term write here.
    let promotionTerm = null;
    if (next_term) {
      try {
        promotionTerm = await academicService.resolveTerm(next_term, academic_year);
      } catch (termError) {
        return res.status(400).json({ error: termError.message });
      }
    }

    const params = [];
    let paramIndex = 1;
    const updates = [];
    let queryText = "UPDATE learners SET ";

    // Promotion targets a real class, so the same canonical form applies here
    // as on create: "Grade 7", never a bare "7" from a caller.
    const promotionGrade = normalizeGrade(next_grade);
    if (next_grade && !promotionGrade) {
      return res
        .status(400)
        .json({ error: "Next grade must be a grade between 1 and 12." });
    }

    if (promotionGrade) {
      updates.push(`grade = $${paramIndex}`);
      params.push(promotionGrade);
      paramIndex++;
    }

    if (promotionTerm) {
      updates.push(`term = $${paramIndex}`);
      params.push(promotionTerm.term);
      paramIndex++;
    }

    // Keep the year tied to the resolved term rather than trusting a separate
    // client value, so term and academic_year cannot disagree on the record.
    const resolvedAcademicYear = promotionTerm
      ? promotionTerm.academic_year
      : academic_year;
    if (resolvedAcademicYear) {
      updates.push(`academic_year = $${paramIndex}`);
      params.push(resolvedAcademicYear);
      paramIndex++;
    }

    updates.push("updated_at = NOW()");
    queryText += `${updates.join(", ")} WHERE school_id = $${paramIndex}`;
    params.push(schoolId);
    paramIndex++;

    if (Array.isArray(learner_ids) && learner_ids.length > 0) {
      queryText += ` AND id = ANY($${paramIndex})`;
      params.push(learner_ids);
      paramIndex++;
    } else {
      if (grade) {
        queryText += ` AND grade = $${paramIndex}`;
        params.push(grade);
        paramIndex++;
      }

      if (stream) {
        queryText += ` AND stream = $${paramIndex}`;
        params.push(stream);
        paramIndex++;
      }
    }

    queryText += " RETURNING *";

    const result = await query(queryText, params);
    res.json({
      message: `Updated ${result.rows.length} learners`,
      learners: result.rows,
    });
  } catch (error) {
    console.error("Promote learners error:", error);
    res.status(500).json({ error: "Failed to promote learners" });
  }
}

async function graduateLearner(req, res) {
  try {
    const learnerResult = await query(
      "SELECT id, school_id, full_name FROM learners WHERE id = $1",
      [req.params.id]
    );
    const learner = learnerResult.rows[0];
    if (!learner) {
      return res.status(404).json({ error: "Learner not found" });
    }
    if (
      req.user.role !== "system_admin" &&
      Number(learner.school_id) !== Number(req.user.schoolId)
    ) {
      return res.status(403).json({ error: "Learner is outside your school" });
    }
    if (req.user.role === "teacher") {
      await teacherAssignmentsService.assertTeacherLearnerAccess(
        req.user,
        learner.id
      );
    }
    const graduated = await query(
      `UPDATE learners
       SET graduation_status = 'graduated',
           graduated_at = CURRENT_TIMESTAMP,
           graduated_by_user_id = $2,
           graduation_note = NULLIF($3, ''),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [learner.id, req.user.userId, req.body.note || ""]
    );
    res.json(graduated.rows[0]);
  } catch (error) {
    console.error("Graduate learner error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to graduate learner" });
  }
}

async function deleteLearner(req, res) {
  try {
    const result = await query(
      "DELETE FROM learners WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Learner not found" });
    }

    res.json({ message: "Learner deleted successfully" });
  } catch (error) {
    console.error("Delete learner error:", error);
    res.status(500).json({ error: "Failed to delete learner" });
  }
}

async function resetLearnerPassword(req, res) {
  try {
    const learnerResult = await query("SELECT * FROM learners WHERE id = $1", [
      req.params.id,
    ]);
    const learner = learnerResult.rows[0];

    if (!learner) {
      return res.status(404).json({ error: "Learner not found" });
    }

    if (
      req.user.role === "school_admin" &&
      Number(learner.school_id) !== Number(req.user.schoolId)
    ) {
      return res.status(403).json({ error: "Learner is outside your school" });
    }

    if (!learner.user_id) {
      return res.status(400).json({
        error:
          "Learner login account is not linked yet. Re-save the learner profile before resetting the password.",
      });
    }

    const userResult = await query(
      `SELECT id, email, full_name, username, role, school_id
       FROM users
       WHERE id = $1 AND is_active = true`,
      [learner.user_id]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Learner login account not found" });
    }

    const providedTemporaryPassword = String(
      req.body.temporary_password || ""
    ).trim();

    if (providedTemporaryPassword && providedTemporaryPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Temporary password must be at least 8 characters." });
    }

    if (
      !providedTemporaryPassword &&
      authService.isDeliverableEmail(user.email)
    ) {
      const result = await authService.sendPasswordResetLinkForUser(
        user,
        req.user.userId,
        req.ip,
        req.get("user-agent")
      );
      return res.json(result);
    }

    const temporaryPassword =
      providedTemporaryPassword || generateRandomPassword(14);
    const hashedPassword = await hashPassword(temporaryPassword);
    await query(
      `UPDATE users
       SET password = $1, force_password_reset = true, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, learner.user_id]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
       VALUES ($1, 'learner_temporary_password_issued', 'user', $1, $2, $3)`,
      [
        learner.user_id,
        JSON.stringify({
          requestedBy: req.user.userId,
          reason: providedTemporaryPassword
            ? "staff_entered_temporary_password"
            : "no_deliverable_email",
        }),
        req.ip || null,
      ]
    );

    res.json({
      message: providedTemporaryPassword
        ? "Temporary password saved. The learner must change it at next sign-in."
        : "Learner has no reachable email. A one-time temporary password was generated and must be changed at next sign-in.",
      temporaryPassword: providedTemporaryPassword
        ? undefined
        : temporaryPassword,
    });
  } catch (error) {
    console.error("Reset learner password error:", error);
    res.status(500).json({ error: "Failed to reset learner password" });
  }
}

async function downloadCredentialCards(req, res) {
  try {
    const schoolId =
      req.user.role === "school_admin"
        ? req.user.schoolId
        : req.query.school_id;
    const learnerIds = req.query.learner_ids
      ? req.query.learner_ids.split(",").map((id) => Number(id))
      : [];

    if (!schoolId) {
      return res.status(400).json({ error: "School is required" });
    }

    const pdfPath = await learnersService.generateCredentialCardsPDF({
      schoolId,
      learnerIds,
      systemUrl: env.frontendUrl,
      defaultPassword: env.defaultLearnerPassword,
    });

    res.download(pdfPath, "learner-login-cards.pdf");
  } catch (error) {
    console.error("Download credential cards error:", error);
    res
      .status(500)
      .json({ error: "Failed to generate learner credential cards" });
  }
}

module.exports = {
  getAllLearners,
  getLearnerStreak,
  getPopulation,
  createLearner,
  bulkCreateLearners,
  getLearnerById,
  updateLearner,
  promoteLearners,
  resetLearnerPassword,
  downloadCredentialCards,
  deleteLearner,
  graduateLearner,
};

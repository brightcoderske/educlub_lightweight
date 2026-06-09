const { query } = require("../config");

function parsePercent(value) {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const score = Number(match[0]);
  return Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : null;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/^(quiz|assignment|lesson|page|url|file|scorm package)\b[:\s-]*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractWeekNumber(value) {
  const text = normalizeName(value);
  const weekMatch = text.match(/\bweek\s*(\d{1,2})\b/);
  if (weekMatch) return Number(weekMatch[1]);

  const trailingNumber = text.match(/\bquiz\s*(\d{1,2})\b/);
  return trailingNumber ? Number(trailingNumber[1]) : null;
}

function extractGradeRows(gradesTable = {}) {
  const rows = gradesTable.tables?.[0]?.tabledata || [];
  return rows
    .filter((row) => /\bitem\b/.test(row.itemname?.class || ""))
    .map((row, index) => ({
      id: row.itemname?.id || `grade-row-${index + 1}`,
      name: stripHtml(row.itemname?.content) || `Grade item ${index + 1}`,
      score: parsePercent(row?.percentage?.content || row?.grade?.content || row?.grade),
    }))
    .filter((row) => !/^aggregation\s+course\s+total$/i.test(row.name));
}

function extractSectionWeekMap(content = []) {
  const mapping = new Map();

  (content || []).forEach((section) => {
    const weekNumber = extractWeekNumber(
      section.name || section.summary || `Week ${section.section || ""}`
    );
    if (!weekNumber) return;

    const modules = Array.isArray(section.modules) ? section.modules : [];
    modules.forEach((module) => {
      const isQuiz =
        String(module.modname || "").toLowerCase() === "quiz" ||
        normalizeName(module.name).includes("quiz");
      if (!isQuiz) return;

      mapping.set(normalizeName(module.name), Number(weekNumber));
    });
  });

  return mapping;
}

function extractWeeklyQuizPerformance(gradesTable = {}, content = []) {
  const weekly = new Map();
  const sectionWeekMap = extractSectionWeekMap(content);

  extractGradeRows(gradesTable).forEach((row) => {
    if (row.score === null) return;
    const weekNumber =
      extractWeekNumber(row.name) || sectionWeekMap.get(normalizeName(row.name));
    if (!weekNumber) return;
    const bucket = weekly.get(weekNumber) || [];
    bucket.push(row.score);
    weekly.set(weekNumber, bucket);
  });

  return [...weekly.entries()]
    .map(([weekNumber, scores]) => ({
      week_number: Number(weekNumber),
      quiz_score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    }))
    .sort((left, right) => left.week_number - right.week_number);
}

async function getWeeklyCourses(req, res) {
  try {
    const category = req.query.category;
    const params = [];
    let categorySql = "AND c.course_category = 'weekly_quiz'";

    if (category === "weekly_quiz") {
      params.push(category);
      categorySql = `AND c.course_category = $${params.length}`;
    } else if (category === "weekly_typing") {
      return res.json([]);
    }

    let learnerJoin = "";
    if (req.user.role === "learner") {
      params.push(req.user.userId);
      learnerJoin = `
        JOIN learners l ON l.user_id = $${params.length}
        JOIN course_allocations a
          ON a.course_id = c.id
         AND a.learner_id = l.id
         AND a.status IN ('active', 'in_progress', 'completed')
      `;
    }

    const result = await query(
      `SELECT DISTINCT c.*
       FROM courses c
       ${learnerJoin}
       WHERE c.is_active = true
         ${categorySql}
       ORDER BY c.course_category, c.name`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get weekly courses error:", error);
    res.status(500).json({ error: "Failed to get typing/quizzes courses" });
  }
}

async function syncWeeklyResults(req, res) {
  try {
    const { term, academic_year, week_number } = req.body;

    if (!term || !academic_year) {
      return res.status(400).json({ error: "Term and academic year are required" });
    }

    res.json({
      message:
        "Native weekly quiz scoring will be recorded through eduClub activities.",
      synced: 0,
      week_number: week_number || null,
    });
  } catch (error) {
    console.error("Sync weekly results error:", error);
    res.status(500).json({ error: "Failed to sync typing/quizzes results" });
  }
}

module.exports = {
  getWeeklyCourses,
  syncWeeklyResults,
};

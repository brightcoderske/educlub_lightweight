const { query } = require("../config");
const academicService = require("../services/academic.service");

async function getAllAcademicYears(req, res) {
  try {
    const years = await academicService.getAllAcademicYears();
    res.json(years);
  } catch (error) {
    console.error("Get academic years error:", error);
    res.status(500).json({ error: "Failed to get academic years" });
  }
}

async function createAcademicYear(req, res) {
  try {
    const year = await academicService.createAcademicYear(req.body);
    res.status(201).json(year);
  } catch (error) {
    console.error("Create academic year error:", error);
    res.status(500).json({ error: "Failed to create academic year" });
  }
}

async function getAcademicYearById(req, res) {
  try {
    const result = await query("SELECT * FROM academic_years WHERE id = $1", [
      req.params.id,
    ]);
    const year = result.rows[0];

    if (!year) {
      return res.status(404).json({ error: "Academic year not found" });
    }

    res.json(year);
  } catch (error) {
    console.error("Get academic year error:", error);
    res.status(500).json({ error: "Failed to get academic year" });
  }
}

async function updateAcademicYear(req, res) {
  try {
    const year = await academicService.updateAcademicYear(req.params.id, req.body);

    if (!year) {
      return res.status(404).json({ error: "Academic year not found" });
    }

    res.json(year);
  } catch (error) {
    console.error("Update academic year error:", error);
    res.status(500).json({ error: "Failed to update academic year" });
  }
}

async function deleteAcademicYear(req, res) {
  try {
    const result = await query(
      "DELETE FROM academic_years WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Academic year not found" });
    }

    res.json({ message: "Academic year deleted successfully" });
  } catch (error) {
    console.error("Delete academic year error:", error);
    res.status(500).json({ error: "Failed to delete academic year" });
  }
}

async function getAllTerms(req, res) {
  try {
    const terms = await academicService.getAllTerms();
    res.json(terms);
  } catch (error) {
    console.error("Get terms error:", error);
    res.status(500).json({ error: "Failed to get terms" });
  }
}

async function getCurrentTerm(req, res) {
  try {
    const term = await academicService.getActiveTerm(
      req.query.term_type || "regular"
    );

    if (!term) {
      return res
        .status(404)
        .json({ error: "No active term found for today's date" });
    }

    res.json(term);
  } catch (error) {
    console.error("Get current term error:", error);
    res.status(500).json({ error: "Failed to get current term" });
  }
}

async function createTerm(req, res) {
  try {
    const term = await academicService.createTerm(req.body);
    res.status(201).json(term);
  } catch (error) {
    console.error("Create term error:", error);
    res.status(500).json({ error: "Failed to create term" });
  }
}

async function getTermById(req, res) {
  try {
    const result = await query("SELECT * FROM terms WHERE id = $1", [
      req.params.id,
    ]);
    const term = result.rows[0];

    if (!term) {
      return res.status(404).json({ error: "Term not found" });
    }

    res.json(term);
  } catch (error) {
    console.error("Get term error:", error);
    res.status(500).json({ error: "Failed to get term" });
  }
}

async function updateTerm(req, res) {
  try {
    const term = await academicService.updateTerm(req.params.id, req.body);

    if (!term) {
      return res.status(404).json({ error: "Term not found" });
    }

    res.json(term);
  } catch (error) {
    console.error("Update term error:", error);
    res.status(500).json({ error: "Failed to update term" });
  }
}

async function deleteTerm(req, res) {
  try {
    const result = await query("DELETE FROM terms WHERE id = $1 RETURNING *", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Term not found" });
    }

    res.json({ message: "Term deleted successfully" });
  } catch (error) {
    console.error("Delete term error:", error);
    res.status(500).json({ error: "Failed to delete term" });
  }
}

async function getTermWeeks(req, res) {
  try {
    const weeks = await academicService.getTermWeeks(req.params.termId);
    res.json(weeks);
  } catch (error) {
    console.error("Get term weeks error:", error);
    res.status(500).json({ error: "Failed to get term weeks" });
  }
}

async function calculateTermWeeks(req, res) {
  try {
    const { termId } = req.params;
    const result = await academicService.calculateTermWeeks(termId);

    res.json({
      message: `Calculated ${result.totalWeeks} weeks for term`,
      weeks: result.weeks,
    });
  } catch (error) {
    console.error("Calculate term weeks error:", error);
    if (error.message === "Term not found") {
      return res.status(404).json({ error: "Term not found" });
    }
    res.status(500).json({ error: "Failed to calculate term weeks" });
  }
}

module.exports = {
  getAllAcademicYears,
  createAcademicYear,
  getAcademicYearById,
  updateAcademicYear,
  deleteAcademicYear,
  getAllTerms,
  getCurrentTerm,
  createTerm,
  getTermById,
  updateTerm,
  deleteTerm,
  getTermWeeks,
  calculateTermWeeks,
};

const publicRegistrationService = require("../services/publicRegistration.service");
const { recordSecurityEvent } = require("../services/securityAudit.service");

async function schools(req, res) {
  try {
    res.json(await publicRegistrationService.listPublicSchools());
  } catch (error) {
    console.error("Public schools error:", error);
    res.status(500).json({ error: "Failed to load schools" });
  }
}

async function terms(req, res) {
  try {
    res.json(await publicRegistrationService.listPublicTerms());
  } catch (error) {
    console.error("Public terms error:", error);
    res.status(500).json({ error: "Failed to load academic terms" });
  }
}

async function registerLearner(req, res) {
  try {
    await recordSecurityEvent({
      action: "learner_registration_attempt",
      details: {
        schoolId: req.body?.schoolId || req.body?.school_id || null,
        grade: req.body?.grade || "",
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    const result = await publicRegistrationService.registerLearner(
      req.body,
      req.ip,
      req.get("user-agent"),
    );
    res.status(201).json(result);
  } catch (error) {
    console.error("Public learner registration error:", error);
    await recordSecurityEvent({
      action: "learner_registration_failed",
      details: { reason: error.message },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    const duplicateEmail = /already exists/i.test(error.message || "");
    res.status(400).json({
      error: duplicateEmail
        ? "Registration could not be completed. Please check the details or contact support."
        : error.message,
    });
  }
}

module.exports = {
  schools,
  terms,
  registerLearner,
};

const publicRegistrationService = require("../services/publicRegistration.service");

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
    const result = await publicRegistrationService.registerLearner(
      req.body,
      req.ip,
      req.get("user-agent"),
    );
    res.status(201).json(result);
  } catch (error) {
    console.error("Public learner registration error:", error);
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  schools,
  terms,
  registerLearner,
};

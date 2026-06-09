const privacyService = require("../services/privacy.service");

async function getConsentStatus(req, res) {
  try {
    const status = await privacyService.getConsentStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    console.error("Get consent status error:", error);
    res.status(500).json({ error: "Failed to load privacy consent status" });
  }
}

async function acceptConsent(req, res) {
  try {
    const consent = await privacyService.acceptConsent(
      req.user.userId,
      req.ip,
      req.get("user-agent")
    );
    res.status(201).json({ consent });
  } catch (error) {
    console.error("Accept consent error:", error);
    res.status(500).json({ error: "Failed to store privacy consent" });
  }
}

module.exports = {
  getConsentStatus,
  acceptConsent,
};

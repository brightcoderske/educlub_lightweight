const express = require("express");
const router = express.Router();
const privacyController = require("../controllers/privacy.controller");
const { authenticateToken } = require("../middleware");

router.get("/consent", authenticateToken, privacyController.getConsentStatus);
router.post("/consent", authenticateToken, privacyController.acceptConsent);

module.exports = router;

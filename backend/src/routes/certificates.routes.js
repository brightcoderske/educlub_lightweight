const express = require("express");
const router = express.Router();
const certificatesController = require("../controllers/certificates.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.get("/", authenticateToken, certificatesController.getAllCertificates);
router.get(
  "/:id",
  authenticateToken,
  certificatesController.getCertificateById
);
router.post(
  "/generate",
  authenticateToken,
  certificatesController.generateCertificate
);
router.get(
  "/download/:id",
  authenticateToken,
  certificatesController.downloadCertificate
);
router.put(
  "/:id/approve",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  certificatesController.approveCertificate
);

module.exports = router;

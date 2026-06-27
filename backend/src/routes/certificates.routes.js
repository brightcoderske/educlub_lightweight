const express = require("express");
const router = express.Router();
const certificatesController = require("../controllers/certificates.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.get("/", authenticateToken, certificatesController.getAllCertificates);
router.get(
  "/download/:id",
  authenticateToken,
  certificatesController.downloadCertificate
);
router.post(
  "/generate",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  certificatesController.generateCertificate
);
router.get(
  "/:id",
  authenticateToken,
  certificatesController.getCertificateById
);
router.put(
  "/:id/approve",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  certificatesController.approveCertificate
);

module.exports = router;

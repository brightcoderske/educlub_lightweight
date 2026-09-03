const express = require("express");
const router = express.Router();
const schoolsController = require("../controllers/schools.controller");
const custody = require("../controllers/schoolCustody.controller");
const {
  authenticateToken,
  isSystemAdmin,
  requireRole,
} = require("../middleware");

router.get("/", authenticateToken, schoolsController.getAllSchools);
router.post(
  "/",
  authenticateToken,
  isSystemAdmin,
  schoolsController.createSchool
);
router.post(
  "/logo",
  authenticateToken,
  isSystemAdmin,
  schoolsController.uploadSchoolLogo
);
// Custodian surface: the system administrator looking after a school as a
// customer. Every route here is system-admin only.
router.get("/invoices", authenticateToken, isSystemAdmin, custody.listInvoices);
// eduClub's own billing identity: legal name, KRA PIN and whether VAT applies.
router.get("/billing-identity", authenticateToken, isSystemAdmin, custody.getIdentity);
router.put("/billing-identity", authenticateToken, isSystemAdmin, custody.updateIdentity);
// ":kind" is "invoice" or "receipt"; a receipt is refused until payment is
// confirmed.
router.get(
  "/invoices/:invoiceId/:kind.pdf",
  authenticateToken,
  isSystemAdmin,
  custody.downloadInvoice,
);
router.put(
  "/invoices/:invoiceId/status",
  authenticateToken,
  isSystemAdmin,
  custody.updateInvoiceStatus,
);
router.get("/:id/enrollments", authenticateToken, isSystemAdmin, custody.getSchoolEnrollments);
router.get("/:id/activity", authenticateToken, isSystemAdmin, custody.getSchoolActivity);
router.put("/:id/suspension", authenticateToken, isSystemAdmin, custody.setSuspension);
router.put("/:id/billing-rate", authenticateToken, isSystemAdmin, custody.setBillingRate);
router.get("/:id/invoices", authenticateToken, isSystemAdmin, custody.listInvoices);
router.get("/:id/invoices/preview", authenticateToken, isSystemAdmin, custody.previewInvoice);
router.post("/:id/invoices", authenticateToken, isSystemAdmin, custody.issueInvoice);
router.get("/:id/learners", authenticateToken, isSystemAdmin, schoolsController.getSchoolLearners);
router.get(
  "/:id/learners/export",
  authenticateToken,
  isSystemAdmin,
  schoolsController.exportSchoolLearners
);
router.get("/:id", authenticateToken, schoolsController.getSchoolById);
router.put(
  "/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  schoolsController.updateSchool
);
router.delete(
  "/:id",
  authenticateToken,
  isSystemAdmin,
  schoolsController.deleteSchool
);

module.exports = router;

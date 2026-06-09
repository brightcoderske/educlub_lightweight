const express = require("express");
const competitionsController = require("../controllers/competitions.controller");
const { authenticateToken } = require("../middleware");

const router = express.Router();

router.get("/", authenticateToken, competitionsController.list);
router.post("/", authenticateToken, competitionsController.create);
router.put("/:id", authenticateToken, competitionsController.update);
router.post("/banner", authenticateToken, competitionsController.uploadBanner);
router.post("/:id/enroll", authenticateToken, competitionsController.enroll);
router.post(
  "/payments/verify",
  authenticateToken,
  competitionsController.verifyPayment
);
router.post("/payments/webhook", competitionsController.flutterwaveWebhook);
router.post("/:id/launch", authenticateToken, competitionsController.launch);
router.get(
  "/:id/performance",
  authenticateToken,
  competitionsController.learnerPerformance
);
router.get("/report", authenticateToken, competitionsController.systemReport);
router.get(
  "/school/report",
  authenticateToken,
  competitionsController.schoolReport
);

module.exports = router;

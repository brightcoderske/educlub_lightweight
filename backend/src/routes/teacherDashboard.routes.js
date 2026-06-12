const express = require("express");
const controller = require("../controllers/teacherDashboard.controller");
const { authenticateToken, requireRole } = require("../middleware");

const router = express.Router();
router.get(
  "/",
  authenticateToken,
  requireRole("teacher"),
  controller.getDashboard,
);

module.exports = router;

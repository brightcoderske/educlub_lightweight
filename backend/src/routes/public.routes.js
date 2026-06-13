const express = require("express");
const publicController = require("../controllers/public.controller");

const router = express.Router();

router.get("/schools", publicController.schools);
router.get("/terms", publicController.terms);
router.post("/register/learner", publicController.registerLearner);

module.exports = router;

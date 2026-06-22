const express = require("express");
const paymentsController = require("../controllers/payments.controller");

const router = express.Router();

router.post("/flutterwave/webhook", paymentsController.flutterwaveWebhook);

module.exports = router;

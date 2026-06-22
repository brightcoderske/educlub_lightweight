const flutterwave = require("../services/flutterwave.service");
const competitionsService = require("../services/competitions.service");
const coursesService = require("../services/courses.service");

function webhookTransaction(payload = {}) {
  return payload.data || payload.event?.data || {};
}

function resolvePaymentKind(payload = {}) {
  const transaction = webhookTransaction(payload);
  const txRef = transaction.tx_ref || payload.tx_ref || "";
  const meta = transaction.meta || transaction.metadata || payload.meta || {};

  if (meta.paymentType === "course_access" || txRef.startsWith("educlub-course-")) {
    return "course";
  }
  if (txRef.startsWith("educlub-comp-") || meta.competitionId || meta.enrollmentId) {
    return "competition";
  }
  return "";
}

async function flutterwaveWebhook(req, res) {
  try {
    const validSignature = flutterwave.isValidWebhookSignature({
      rawBody: req.rawBody,
      signature: req.get("flutterwave-signature"),
      legacyHash: req.get("verif-hash"),
    });

    if (!validSignature) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const kind = resolvePaymentKind(req.body);
    if (kind === "course") {
      return res.json(await coursesService.processCoursePaymentWebhook(req.body));
    }
    if (kind === "competition") {
      return res.json(await competitionsService.processFlutterwaveWebhook(req.body));
    }

    return res.json({
      accepted: true,
      ignored: true,
      reason: "Webhook payment type is not handled by eduClub.",
    });
  } catch (error) {
    console.error("Flutterwave unified webhook error:", error);
    res.status(400).json({ error: error.message || "Failed to process payment webhook" });
  }
}

module.exports = {
  flutterwaveWebhook,
};

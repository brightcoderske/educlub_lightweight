const { query } = require("../config");
const fs = require("fs");
const path = require("path");
const competitionsService = require("../services/competitions.service");
const flutterwave = require("../services/flutterwave.service");

function getPublicUploadUrl(req, relativePath) {
  return `${req.protocol}://${req.get("host")}${relativePath.replace(
    /\\/g,
    "/"
  )}`;
}

async function list(req, res) {
  try {
    const competitions =
      req.user.role === "learner"
        ? await competitionsService.listCompetitionsForLearner(req.user.userId)
        : await competitionsService.listCompetitions();
    res.json(competitions);
  } catch (error) {
    console.error("List competitions error:", error);
    res.status(500).json({ error: "Failed to list competitions" });
  }
}

async function create(req, res) {
  try {
    if (req.user.role !== "system_admin") {
      return res.status(403).json({ error: "System admin access required" });
    }

    const competition = await competitionsService.createCompetition(
      req.body,
      req.user.userId
    );
    res.status(201).json(competition);
  } catch (error) {
    console.error("Create competition error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function update(req, res) {
  try {
    if (req.user.role !== "system_admin") {
      return res.status(403).json({ error: "System admin access required" });
    }

    const competition = await competitionsService.updateCompetition(
      req.params.id,
      req.body
    );
    res.json(competition);
  } catch (error) {
    console.error("Update competition error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function uploadBanner(req, res) {
  try {
    if (req.user.role !== "system_admin") {
      return res.status(403).json({ error: "System admin access required" });
    }

    const { fileName, dataUrl } = req.body;

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return res
        .status(400)
        .json({ error: "Please upload a PNG or JPG image." });
    }

    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);
    if (!match) {
      return res
        .status(400)
        .json({ error: "Banner must be a PNG or JPG image." });
    }

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 2 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "Banner image must be 2MB or smaller." });
    }

    const extension = match[1].includes("png") ? "png" : "jpg";
    const safeName = `${Date.now()}-${(fileName || "competition-banner")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase()}.${extension}`;
    const uploadDir = path.join(__dirname, "../../uploads/competition-banners");
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, safeName), buffer);

    res.json({
      image_url: getPublicUploadUrl(
        req,
        `/uploads/competition-banners/${safeName}`
      ),
    });
  } catch (error) {
    console.error("Upload competition banner error:", error);
    res.status(500).json({ error: "Failed to upload competition banner" });
  }
}

async function enroll(req, res) {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ error: "Learner access required" });
    }

    const result = await competitionsService.enrollOrStartPayment(
      req.params.id,
      req.user
    );
    res.json(result);
  } catch (error) {
    console.error("Competition enrollment error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function verifyPayment(req, res) {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ error: "Learner access required" });
    }

    const result = await competitionsService.verifyPayment({
      transactionId: req.body.transaction_id,
      txRef: req.body.tx_ref,
    });
    res.json(result);
  } catch (error) {
    console.error("Competition payment verification error:", error);
    res.status(400).json({ error: error.message });
  }
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

    const result = await competitionsService.processFlutterwaveWebhook(
      req.body
    );

    res.json(result);
  } catch (error) {
    console.error("Flutterwave competition webhook error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function launch(req, res) {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ error: "Learner access required" });
    }

    const result = await query(
      `SELECT c.*,
              ce.status AS enrollment_status,
              l.id AS learner_id,
              l.email AS learner_email,
              l.full_name AS learner_name
       FROM competitions c
       JOIN competition_enrollments ce ON ce.competition_id = c.id
       JOIN learners l ON l.id = ce.learner_id
       WHERE c.id = $1 AND l.user_id = $2`,
      [req.params.id, req.user.userId]
    );
    const competition = result.rows[0];

    if (!competition || competition.enrollment_status !== "enrolled") {
      return res
        .status(403)
        .json({ error: "You are not enrolled in this competition" });
    }

    if (competition.competition_type === "typing") {
      const typingTest = await query(
        `SELECT id
         FROM typing_tests
         WHERE competition_id = $1
           AND test_type = 'competition'
           AND is_published = true
           AND is_open = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [competition.id]
      );
      const testId = typingTest.rows[0]?.id;
      if (!testId) {
        return res.status(400).json({
          error:
            "Native typing test is not published for this competition yet. Create and publish it in Typing / Quizzes.",
        });
      }
      return res.json({
        nativeTyping: true,
        typingTestId: testId,
        launchUrl: `/learner/typing-quizzes?test=${testId}&competition=${competition.id}&autostart=1`,
      });
    }

    return res.status(400).json({
      error:
        "Native competition activity is not published yet. Create a quiz, coding, or project activity for this competition.",
    });
  } catch (error) {
    console.error("Competition course launch error:", error);
    res.status(500).json({ error: "Failed to launch competition" });
  }
}

async function learnerPerformance(req, res) {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ error: "Learner access required" });
    }

    const result = await competitionsService.getLearnerCompetitionPerformance(
      req.user.userId,
      req.params.id,
      req.query.stage
    );
    res.json(result);
  } catch (error) {
    console.error("Competition performance error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function schoolReport(req, res) {
  try {
    if (req.user.role !== "school_admin" && req.user.role !== "teacher") {
      return res.status(403).json({ error: "School admin access required" });
    }

    const rows = await competitionsService.getSchoolCompetitionReport(
      req.user.schoolId,
      {
        competitionId: req.query.competition_id,
        search: req.query.search,
        sort: req.query.sort,
        status: req.query.status,
        grade: req.query.grade,
        type: req.query.type,
        stage: req.query.stage,
      }
    );
    res.json(rows);
  } catch (error) {
    console.error("Competition school report error:", error);
    res.status(500).json({ error: "Failed to load competition report" });
  }
}

async function systemReport(req, res) {
  try {
    if (req.user.role !== "system_admin") {
      return res.status(403).json({ error: "System admin access required" });
    }

    const rows = await competitionsService.getSchoolCompetitionReport(null, {
      competitionId: req.query.competition_id,
      search: req.query.search,
      sort: req.query.sort,
      status: req.query.status,
      grade: req.query.grade,
      type: req.query.type,
      stage: req.query.stage,
    });
    res.json(rows);
  } catch (error) {
    console.error("Competition system report error:", error);
    res.status(500).json({ error: "Failed to load competition report" });
  }
}

module.exports = {
  list,
  create,
  update,
  uploadBanner,
  enroll,
  verifyPayment,
  flutterwaveWebhook,
  launch,
  learnerPerformance,
  schoolReport,
  systemReport,
};

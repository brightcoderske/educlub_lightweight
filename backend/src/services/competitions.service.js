const crypto = require("crypto");
const { query } = require("../config");
const env = require("../config/env");
const flutterwave = require("./flutterwave.service");

const COMPETITION_TYPES = new Set(["quiz", "typing", "maths", "science", "stem"]);
const RESULT_STAGES = new Set(["practice", "final"]);

function normalizeGrade(value) {
  const text = String(value || "").trim();
  const match = text.match(/\d+/);
  return match ? `Grade ${Number(match[0])}` : text;
}

function normalizeEligibleGrades(value) {
  const grades = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return [...new Set(grades.map(normalizeGrade).filter(Boolean))].sort(
    (a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0)
  );
}

function normalizeCompetitionType(value) {
  const type = String(value || "quiz").toLowerCase();
  return COMPETITION_TYPES.has(type) ? type : "quiz";
}

function normalizeResultStage(value) {
  const stage = String(value || "final").toLowerCase();
  return RESULT_STAGES.has(stage) ? stage : "final";
}

function hydrateCompetition(competition) {
  if (!competition) return null;
  return {
    ...competition,
    eligible_grades: Array.isArray(competition.eligible_grades)
      ? competition.eligible_grades
      : normalizeEligibleGrades(competition.eligible_grades),
    price_amount: Number(competition.price_amount || 0),
  };
}

function isCompetitionVisibleForGrade(competition, learnerGrade) {
  const eligibleGrades = normalizeEligibleGrades(competition.eligible_grades || []);
  return eligibleGrades.length === 0 || eligibleGrades.includes(normalizeGrade(learnerGrade));
}

function availableToEnrollFilter() {
  return "c.is_active = TRUE AND c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE";
}

async function findLearnerForUser(userId) {
  const result = await query(
    "SELECT * FROM learners WHERE user_id = $1 AND is_active = true LIMIT 1",
    [userId]
  );
  return result.rows[0];
}

async function listCompetitionsForLearner(userId) {
  const learner = await findLearnerForUser(userId);
  if (!learner) return [];

  const result = await query(
    `SELECT c.*,
            ce.status AS enrollment_status,
            ce.enrolled_at,
            ce.payment_reference
     FROM competitions c
     LEFT JOIN competition_enrollments ce
       ON ce.competition_id = c.id
      AND ce.learner_id = $1
     WHERE c.is_active = true
     ORDER BY c.is_featured DESC, c.start_date DESC`,
    [learner.id]
  );

  return result.rows
    .filter((competition) => isCompetitionVisibleForGrade(competition, learner.grade))
    .map(hydrateCompetition);
}

async function listCompetitions() {
  const result = await query(
    `SELECT c.*,
            COUNT(ce.id) FILTER (WHERE ce.status = 'enrolled')::integer AS enrolled_count
     FROM competitions c
     LEFT JOIN competition_enrollments ce ON ce.competition_id = c.id
     GROUP BY c.id
     ORDER BY c.is_featured DESC, c.start_date DESC`
  );
  return result.rows.map(hydrateCompetition);
}

async function getCompetitionById(id) {
  const result = await query("SELECT * FROM competitions WHERE id = $1", [id]);
  return hydrateCompetition(result.rows[0]);
}

async function createCompetition(data, createdByUserId) {
  const result = await query(
    `INSERT INTO competitions (
       name, description, competition_type, eligible_grades,
       start_date, end_date, practice_available, image_url,
       price_amount, currency, is_featured, is_active, created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      data.name,
      data.description || "",
      normalizeCompetitionType(data.competition_type),
      JSON.stringify(normalizeEligibleGrades(data.eligible_grades)),
      data.start_date,
      data.end_date,
      Boolean(data.practice_available),
      data.image_url || null,
      Number(data.price_amount || 0),
      data.currency || "KES",
      Boolean(data.is_featured),
      data.is_active !== false,
      createdByUserId,
    ]
  );

  return hydrateCompetition(result.rows[0]);
}

async function updateCompetition(id, data) {
  const result = await query(
    `UPDATE competitions
     SET name = $1,
         description = $2,
         competition_type = $3,
         eligible_grades = $4,
         start_date = $5,
         end_date = $6,
         practice_available = $7,
         image_url = $8,
         price_amount = $9,
         currency = $10,
         is_featured = $11,
         is_active = $12,
         updated_at = NOW()
     WHERE id = $13
     RETURNING *`,
    [
      data.name,
      data.description || "",
      normalizeCompetitionType(data.competition_type),
      JSON.stringify(normalizeEligibleGrades(data.eligible_grades)),
      data.start_date,
      data.end_date,
      Boolean(data.practice_available),
      data.image_url || null,
      Number(data.price_amount || 0),
      data.currency || "KES",
      Boolean(data.is_featured),
      data.is_active !== false,
      id,
    ]
  );

  if (!result.rows[0]) throw new Error("Competition not found.");
  return hydrateCompetition(result.rows[0]);
}

async function enrollOrStartPayment(competitionId, user) {
  const learner = await findLearnerForUser(user.userId);
  if (!learner) throw new Error("Learner profile is not linked to this account.");

  const competitionResult = await query(
    `SELECT * FROM competitions c
     WHERE c.id = $1
       AND ${availableToEnrollFilter()}`,
    [competitionId]
  );
  const competition = competitionResult.rows[0];
  if (!competition) throw new Error("Competition is not open for enrolment.");
  if (!isCompetitionVisibleForGrade(competition, learner.grade)) {
    throw new Error("This competition is not available for your grade.");
  }

  const amount = Number(competition.price_amount || 0);
  const enrollmentResult = await query(
    `INSERT INTO competition_enrollments (
       competition_id, learner_id, status, amount_paid, currency, enrolled_at
     )
     VALUES ($1, $2, $3, 0, $4, CASE WHEN $3 = 'enrolled' THEN NOW() ELSE NULL END)
     ON CONFLICT (competition_id, learner_id) DO UPDATE
       SET status = CASE
             WHEN competition_enrollments.status = 'enrolled' THEN 'enrolled'
             WHEN EXCLUDED.status = 'enrolled' THEN 'enrolled'
             ELSE 'pending_payment'
           END,
           currency = EXCLUDED.currency,
           enrolled_at = CASE
             WHEN competition_enrollments.status = 'enrolled'
               OR EXCLUDED.status = 'enrolled'
             THEN COALESCE(competition_enrollments.enrolled_at, NOW())
             ELSE competition_enrollments.enrolled_at
           END,
           updated_at = NOW()
     RETURNING *`,
    [competition.id, learner.id, amount > 0 ? "pending_payment" : "enrolled", competition.currency || "KES"]
  );
  const enrollment = enrollmentResult.rows[0];

  if (enrollment.status === "enrolled") {
    return { status: "enrolled", enrollment };
  }

  if (!flutterwave.isConfigured()) {
    throw new Error("Payment is not configured yet. Contact the system administrator.");
  }

  const txRef = `educlub-comp-${competition.id}-${learner.id}-${crypto.randomUUID()}`;
  const payment = await flutterwave.createPaymentLink({
    txRef,
    amount,
    currency: competition.currency || "KES",
    redirectUrl: `${env.frontendUrl}/learner/competitions?tx_ref=${encodeURIComponent(txRef)}`,
    customer: {
      email: learner.email || user.email,
      name: learner.full_name || user.fullName || user.username,
    },
    metadata: {
      competitionId: competition.id,
      competitionName: competition.name,
      learnerId: learner.id,
      enrollmentId: enrollment.id,
    },
  });

  await query(
    `INSERT INTO competition_payments (
       competition_id, learner_id, enrollment_id, tx_ref, amount, currency,
       status, payment_link, raw_response
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
    [
      competition.id,
      learner.id,
      enrollment.id,
      txRef,
      amount,
      competition.currency || "KES",
      payment.link,
      JSON.stringify(payment.raw),
    ]
  );

  return { status: "payment_required", enrollment, paymentLink: payment.link, txRef };
}

async function verifyPayment({ transactionId, txRef }) {
  if (!transactionId) throw new Error("Flutterwave transaction id is required.");
  if (!txRef) throw new Error("Payment reference is required.");

  const paymentResult = await query(
    `SELECT cp.*, c.name AS competition_name
     FROM competition_payments cp
     JOIN competitions c ON c.id = cp.competition_id
     WHERE cp.tx_ref = $1`,
    [txRef]
  );
  const payment = paymentResult.rows[0];
  if (!payment) throw new Error("Payment record not found.");

  if (payment.status === "successful") {
    const enrollmentResult = await query(
      "SELECT * FROM competition_enrollments WHERE id = $1",
      [payment.enrollment_id]
    );
    return { enrollment: enrollmentResult.rows[0], alreadyVerified: true };
  }

  const verification = await flutterwave.verifyTransaction(transactionId);
  const data = verification.data || {};
  const successful =
    data.status === "successful" &&
    data.tx_ref === payment.tx_ref &&
    Number(data.amount) >= Number(payment.amount) &&
    data.currency === payment.currency;

  await query(
    `UPDATE competition_payments
     SET status = $1,
         provider_transaction_id = $2,
         raw_response = $3,
         verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $4`,
    [successful ? "successful" : "failed", String(transactionId), JSON.stringify(verification), payment.id]
  );

  if (!successful) throw new Error("Payment could not be verified.");

  const enrollmentResult = await query(
    `UPDATE competition_enrollments
     SET status = 'enrolled',
         amount_paid = $1,
         payment_reference = $2,
         enrolled_at = COALESCE(enrolled_at, NOW()),
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [payment.amount, payment.tx_ref, payment.enrollment_id]
  );

  return { enrollment: enrollmentResult.rows[0] };
}

function getWebhookTransaction(payload = {}) {
  return payload.data || payload.event?.data || {};
}

async function processFlutterwaveWebhook(payload = {}) {
  const eventType = payload.event || payload.type || "";
  const transaction = getWebhookTransaction(payload);
  const txRef = transaction.tx_ref || payload.tx_ref;
  const transactionId = transaction.id || transaction.transaction_id;

  if (eventType && eventType !== "charge.completed") {
    return { accepted: true, ignored: true, reason: "Webhook event is not a completed charge.", eventType };
  }
  if (transaction.status && transaction.status !== "successful") {
    return { accepted: true, ignored: true, reason: "Webhook transaction is not successful.", eventType, txRef };
  }
  if (!txRef || !transactionId) {
    return { accepted: true, ignored: true, reason: "Webhook did not include a tx_ref and transaction id.", eventType };
  }

  return {
    accepted: true,
    eventType,
    txRef,
    transactionId,
    ...(await verifyPayment({ transactionId, txRef })),
  };
}

function normalizeCompetitionReportFilters(filters = {}) {
  const status = ["available", "current", "past"].includes(filters.status)
    ? filters.status
    : "available";
  const sort = filters.sort === "asc" ? "asc" : "desc";
  const search = String(filters.search || "").trim();
  const competitionId = filters.competitionId || filters.competition_id || null;
  const grade = normalizeGrade(filters.grade || "");
  const type = filters.type ? normalizeCompetitionType(filters.type) : "";
  const stage = normalizeResultStage(filters.stage);
  return { competitionId, grade, search, sort, stage, status, type };
}

async function backfillCompetitionResultMetadata() {
  await query(
    `UPDATE competition_results cr
     SET learner_grade = COALESCE(cr.learner_grade, l.grade),
         competition_type = COALESCE(cr.competition_type, c.competition_type, 'quiz')
     FROM learners l, competitions c
     WHERE cr.learner_id = l.id
       AND cr.competition_id = c.id
       AND (cr.learner_grade IS NULL OR cr.competition_type IS NULL)`
  );
}

async function getSchoolCompetitionReport(schoolId, filters = {}) {
  await backfillCompetitionResultMetadata();
  const normalized = normalizeCompetitionReportFilters(filters);
  const values = [
    schoolId,
    normalized.competitionId,
    normalized.search,
    normalized.grade,
    normalized.type,
    normalized.stage,
  ];
  const timingFilters = {
    available: "c.is_active = TRUE AND c.end_date >= CURRENT_DATE",
    current: "c.is_active = TRUE AND c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE",
    past: "c.end_date < CURRENT_DATE",
  };
  const sortDirection = normalized.sort === "asc" ? "ASC" : "DESC";

  const result = await query(
    `SELECT ce.*,
            l.full_name AS learner_name,
            l.email AS learner_email,
            l.grade,
            l.stream,
            c.name AS competition_name,
            c.competition_type,
            c.start_date,
            c.end_date,
            c.is_active,
            cr.result_stage,
            cr.quiz_score,
            cr.typing_wpm,
            cr.typing_accuracy,
            cr.total_score,
            COALESCE(
              cr.rank,
              RANK() OVER (
                PARTITION BY ce.competition_id, COALESCE(cr.result_stage, $6), l.grade
                ORDER BY cr.total_score DESC NULLS LAST
              )
            ) AS rank,
            COUNT(cr.id) OVER (
              PARTITION BY ce.competition_id, COALESCE(cr.result_stage, $6), l.grade
            )::integer AS participant_count
     FROM competition_enrollments ce
     JOIN learners l ON l.id = ce.learner_id
     JOIN competitions c ON c.id = ce.competition_id
     LEFT JOIN competition_results cr
       ON cr.competition_id = ce.competition_id
      AND cr.learner_id = ce.learner_id
      AND cr.result_stage = $6
     WHERE ($1::integer IS NULL OR l.school_id = $1)
       AND ($2::integer IS NULL OR ce.competition_id = $2)
       AND (
         $3::text = ''
         OR l.full_name ILIKE '%' || $3 || '%'
         OR COALESCE(l.email, '') ILIKE '%' || $3 || '%'
       )
       AND (
         $4::text = ''
         OR regexp_replace(COALESCE(l.grade, ''), '\\D', '', 'g') =
            regexp_replace($4::text, '\\D', '', 'g')
       )
       AND ($5::text = '' OR c.competition_type = $5)
       AND ${timingFilters[normalized.status]}
     ORDER BY cr.total_score ${sortDirection} NULLS LAST, ce.enrolled_at DESC NULLS LAST`,
    values
  );

  return result.rows;
}

async function getLearnerCompetitionPerformance(userId, competitionId, stage = "final") {
  await backfillCompetitionResultMetadata();
  const learner = await findLearnerForUser(userId);
  if (!learner) throw new Error("Learner profile is not linked to this account.");
  const resultStage = normalizeResultStage(stage);

  const result = await query(
    `WITH ranked_results AS (
       SELECT cr.*,
              COALESCE(
                cr.rank,
                RANK() OVER (
                  PARTITION BY cr.competition_id, cr.result_stage, cr.learner_grade
                  ORDER BY cr.total_score DESC NULLS LAST
                )
              ) AS calculated_rank,
              COUNT(*) OVER (
                PARTITION BY cr.competition_id, cr.result_stage, cr.learner_grade
              )::integer AS participant_count
       FROM competition_results cr
       WHERE cr.competition_id = $2
         AND cr.result_stage = $3
     )
     SELECT c.id,
            c.name,
            c.competition_type,
            c.start_date,
            c.end_date,
            ce.status AS enrollment_status,
            ce.enrolled_at,
            l.grade,
            rr.result_stage,
            rr.quiz_score,
            rr.typing_wpm,
            rr.typing_accuracy,
            rr.total_score,
            rr.calculated_rank AS position,
            rr.participant_count
     FROM competitions c
     JOIN competition_enrollments ce
       ON ce.competition_id = c.id AND ce.learner_id = $1
     JOIN learners l ON l.id = ce.learner_id
     LEFT JOIN ranked_results rr
       ON rr.competition_id = c.id AND rr.learner_id = $1
     WHERE c.id = $2
       AND ce.status = 'enrolled'`,
    [learner.id, competitionId, resultStage]
  );

  if (!result.rows[0]) throw new Error("Competition performance is not available.");
  return result.rows[0];
}

module.exports = {
  listCompetitions,
  listCompetitionsForLearner,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  enrollOrStartPayment,
  verifyPayment,
  processFlutterwaveWebhook,
  getSchoolCompetitionReport,
  getLearnerCompetitionPerformance,
};

const { query } = require("../config");
const { withTransaction } = require("../database/transaction");
const { getBillingIdentity } = require("./billingIdentity.service");

/**
 * Schools are billed per enrolled learner per term, at a rate the custodian
 * sets per school.
 *
 * A school with no rate is not free - it is "not billed through eduClub". Those
 * produce a statement (the counts, no money) rather than a priced invoice, so
 * nobody is ever sent a KES 0.00 bill by accident.
 */
function billable(school) {
  const rate = Number(school?.invoice_rate_per_learner);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Learners a school had enrolled in one term. This is the billable quantity. */
async function countEnrolled(schoolId, term, academicYear) {
  const result = await query(
    `SELECT COUNT(*) AS learner_count
     FROM learners
     WHERE school_id = $1 AND term = $2 AND academic_year = $3 AND is_active = true`,
    [schoolId, term, academicYear],
  );
  return Number(result.rows[0]?.learner_count) || 0;
}

async function getSchool(schoolId) {
  const result = await query("SELECT * FROM schools WHERE id = $1", [schoolId]);
  return result.rows[0] || null;
}

/**
 * What an invoice for this term *would* say, without writing anything. The
 * custodian sees this before committing, so an issued invoice is never a
 * surprise.
 */
async function previewInvoice(schoolId, term, academicYear) {
  const school = await getSchool(schoolId);
  if (!school) {
    throw Object.assign(new Error("School not found"), { statusCode: 404 });
  }

  const rate = billable(school);
  const learnerCount = await countEnrolled(schoolId, term, academicYear);
  const identity = await getBillingIdentity();

  // VAT applies only when eduClub is registered for it. An unregistered
  // supplier charging VAT would be issuing an invalid tax invoice.
  const vatApplied = identity.vat_registered === true;
  const vatRate = vatApplied ? Number(identity.vat_rate) || 0 : 0;
  const net = rate === null ? null : Math.round(learnerCount * rate * 100) / 100;

  return {
    school_id: school.id,
    school_name: school.name,
    term,
    academic_year: Number(academicYear),
    learner_count: learnerCount,
    rate_per_learner: rate,
    // Rounded to the currency's minor unit at the point the number is made, so
    // the stored amount and the printed one can never drift apart.
    amount: net,
    vat_applied: vatApplied,
    tax_percent: vatRate,
    tax_amount: net === null ? null : Math.round(net * vatRate) / 100,
    total: net === null ? null : Math.round(net * (100 + vatRate)) / 100,
    currency: school.invoice_currency || "KES",
    issuer_kra_pin: identity.kra_pin || null,
    school_kra_pin: school.kra_pin || null,
    billable: rate !== null,
  };
}

/**
 * Issue the invoice. The count and rate are copied onto the row rather than
 * recomputed on read: a learner enrolling next week must not silently change an
 * invoice that has already been sent.
 *
 * Re-issuing the same term updates the existing row instead of creating a
 * second one, but refuses once it has been paid.
 */
async function issueInvoice(schoolId, term, academicYear, { issuedBy, notes } = {}) {
  const preview = await previewInvoice(schoolId, term, academicYear);

  if (!preview.billable) {
    throw Object.assign(
      new Error("Set a per-learner rate for this school before issuing an invoice."),
      { statusCode: 400 },
    );
  }

  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id, status FROM school_invoices
       WHERE school_id = $1 AND term = $2 AND academic_year = $3
       FOR UPDATE`,
      [schoolId, term, academicYear],
    );

    if (existing.rows[0]?.status === "paid") {
      throw Object.assign(
        new Error("That term is already invoiced and paid. Void it first to re-issue."),
        { statusCode: 409 },
      );
    }

    if (existing.rows[0]) {
      const updated = await client.query(
        `UPDATE school_invoices
         SET learner_count = $1, rate_per_learner = $2, amount = $3, currency = $4,
             status = 'issued', notes = $5, issued_by = $6, issued_at = NOW(),
             vat_applied = $7, tax_percent = $8, updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          preview.learner_count,
          preview.rate_per_learner,
          preview.amount,
          preview.currency,
          notes || null,
          issuedBy || null,
          preview.vat_applied,
          preview.tax_percent,
          existing.rows[0].id,
        ],
      );
      return updated.rows[0];
    }

    const created = await client.query(
      `INSERT INTO school_invoices
         (school_id, term, academic_year, learner_count, rate_per_learner, amount,
          currency, status, notes, issued_by, vat_applied, tax_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'issued', $8, $9, $10, $11)
       RETURNING *`,
      [
        schoolId,
        term,
        academicYear,
        preview.learner_count,
        preview.rate_per_learner,
        preview.amount,
        preview.currency,
        notes || null,
        issuedBy || null,
        preview.vat_applied,
        preview.tax_percent,
      ],
    );
    return created.rows[0];
  });
}

async function listInvoices(schoolId) {
  const result = await query(
    `SELECT i.*, s.name AS school_name
     FROM school_invoices i
     JOIN schools s ON s.id = i.school_id
     WHERE ($1::integer IS NULL OR i.school_id = $1)
     ORDER BY i.academic_year DESC, i.issued_at DESC`,
    [schoolId || null],
  );
  return result.rows;
}

/**
 * Confirming payment is what creates a receipt: the receipt number is issued
 * here and never before, so a receipt cannot exist for money that was not
 * received. Reverting to "issued" or voiding clears it again.
 */
async function setInvoiceStatus(invoiceId, status, { method, reference } = {}) {
  if (!["issued", "paid", "void"].includes(status)) {
    throw Object.assign(new Error("Unknown invoice status."), { statusCode: 400 });
  }

  return withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT * FROM school_invoices WHERE id = $1 FOR UPDATE",
      [invoiceId],
    );
    const invoice = existing.rows[0];

    if (!invoice) {
      throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }

    if (status !== "paid") {
      const cleared = await client.query(
        `UPDATE school_invoices
         SET status = $1, paid_at = NULL, amount_paid = 0, receipt_number = NULL,
             payment_method = NULL, payment_reference = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, invoiceId],
      );
      return cleared.rows[0];
    }

    // Keep an existing receipt number on a re-confirmation: a school may already
    // be holding a printout that quotes it.
    const receiptNumber =
      invoice.receipt_number ||
      `REC-${invoice.academic_year}-${String(invoiceId).padStart(4, "0")}`;

    const paid = await client.query(
      `UPDATE school_invoices
       SET status = 'paid', paid_at = COALESCE(paid_at, NOW()),
           amount_paid = ROUND(amount * (1 - COALESCE(discount_percent, 0) / 100)
                               * (1 + COALESCE(tax_percent, 0) / 100), 2),
           receipt_number = $1, payment_method = $2, payment_reference = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [receiptNumber, method || null, reference || null, invoiceId],
    );
    return paid.rows[0];
  });
}

module.exports = {
  billable,
  countEnrolled,
  previewInvoice,
  issueInvoice,
  listInvoices,
  setInvoiceStatus,
};

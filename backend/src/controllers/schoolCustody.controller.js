const { query } = require("../config");
const billing = require("../services/schoolBilling.service");
const { getSchoolPopulation } = require("../services/schoolPopulation.service");
const { writeInvoicePdf } = require("../services/invoicePdf.service");
const {
  getBillingIdentity,
  setBillingIdentity,
} = require("../services/billingIdentity.service");

/**
 * The custodian view: everything a system administrator needs to look after a
 * school as a customer rather than as a set of learners.
 *
 * Every handler here is mounted behind isSystemAdmin, so none of them re-check
 * the role - the boundary lives in one place, on the routes.
 */

async function recordAudit(req, action, schoolId, values) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
       VALUES ($1, $2, 'school', $3, $4, $5)`,
      [req.user.userId, action, schoolId, JSON.stringify(values), req.ip || null],
    );
  } catch (error) {
    // An audit write must never be the reason a custodian action fails, but a
    // silent gap in the trail is worth a log line.
    console.error("School audit write failed:", action, error.message);
  }
}

async function getSchoolEnrollments(req, res) {
  try {
    res.json(await getSchoolPopulation(req.params.id));
  } catch (error) {
    console.error("School enrollments error:", error);
    res.status(500).json({ error: "Failed to load school enrolments" });
  }
}

/**
 * Recent activity at one school, read from the audit trail the application has
 * been writing all along. Scoped by joining through the acting user's school,
 * since audit_logs records who acted rather than where.
 */
async function getSchoolActivity(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at,
              u.full_name AS actor_name, u.role AS actor_role
       FROM audit_logs a
       JOIN users u ON u.id = a.user_id
       WHERE u.school_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [req.params.id, limit],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("School activity error:", error);
    res.status(500).json({ error: "Failed to load school activity" });
  }
}

async function setSuspension(req, res) {
  try {
    const suspended = req.body.suspended === true;
    const reason = suspended ? String(req.body.reason || "").trim() || null : null;

    const result = await query(
      `UPDATE schools
       SET is_active = $1,
           suspended_at = CASE WHEN $1 = false THEN NOW() ELSE NULL END,
           suspension_reason = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, is_active, suspended_at, suspension_reason`,
      [!suspended, reason, req.params.id],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "School not found" });
    }

    await recordAudit(req, suspended ? "school_suspended" : "school_reinstated", req.params.id, {
      reason,
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("School suspension error:", error);
    res.status(500).json({ error: "Failed to update school access" });
  }
}

async function setBillingRate(req, res) {
  try {
    const rate = req.body.rate_per_learner;
    const parsed = rate === null || rate === "" ? null : Number(rate);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      return res.status(400).json({ error: "Enter a rate of zero or more, or clear it." });
    }

    const result = await query(
      `UPDATE schools
       SET invoice_rate_per_learner = $1,
           invoice_currency = COALESCE($2, invoice_currency, 'KES'),
           kra_pin = COALESCE($3, kra_pin),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, invoice_rate_per_learner, invoice_currency, kra_pin`,
      [
        parsed,
        req.body.currency || null,
        req.body.kra_pin === undefined
          ? null
          : String(req.body.kra_pin || "").trim().toUpperCase() || null,
        req.params.id,
      ],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "School not found" });
    }

    await recordAudit(req, "school_billing_rate_set", req.params.id, {
      rate_per_learner: parsed,
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("School billing rate error:", error);
    res.status(500).json({ error: "Failed to save the billing rate" });
  }
}

function fail(res, error, fallback) {
  if (!error.statusCode) console.error(fallback, error);
  res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : fallback,
  });
}

async function previewInvoice(req, res) {
  try {
    const { term, academic_year: academicYear } = req.query;
    if (!term || !academicYear) {
      return res.status(400).json({ error: "Choose a term and academic year." });
    }
    res.json(await billing.previewInvoice(req.params.id, term, Number(academicYear)));
  } catch (error) {
    fail(res, error, "Failed to prepare the invoice");
  }
}

async function issueInvoice(req, res) {
  try {
    const { term, academic_year: academicYear, notes } = req.body;
    if (!term || !academicYear) {
      return res.status(400).json({ error: "Choose a term and academic year." });
    }
    const invoice = await billing.issueInvoice(req.params.id, term, Number(academicYear), {
      issuedBy: req.user.userId,
      notes,
    });
    await recordAudit(req, "school_invoice_issued", req.params.id, {
      invoice_id: invoice.id,
      amount: invoice.amount,
    });
    res.status(201).json(invoice);
  } catch (error) {
    fail(res, error, "Failed to issue the invoice");
  }
}

async function listInvoices(req, res) {
  try {
    res.json(await billing.listInvoices(req.params.id || null));
  } catch (error) {
    fail(res, error, "Failed to load invoices");
  }
}

async function updateInvoiceStatus(req, res) {
  try {
    const invoice = await billing.setInvoiceStatus(req.params.invoiceId, req.body.status, {
      method: req.body.payment_method,
      reference: req.body.payment_reference,
    });
    await recordAudit(req, "school_invoice_status_changed", invoice.school_id, {
      invoice_id: invoice.id,
      status: invoice.status,
    });
    res.json(invoice);
  } catch (error) {
    fail(res, error, "Failed to update the invoice");
  }
}

async function downloadInvoice(req, res) {
  try {
    const kind = req.params.kind === "receipt" ? "receipt" : "invoice";
    const result = await query(
      `SELECT i.*, s.name AS school_name, s.email AS school_email,
              s.phone AS school_phone, s.kra_pin AS school_kra_pin
       FROM school_invoices i
       JOIN schools s ON s.id = i.school_id
       WHERE i.id = $1`,
      [req.params.invoiceId],
    );
    const invoice = result.rows[0];

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // A receipt is proof that money arrived. It cannot exist before payment is
    // confirmed, so this refuses rather than rendering an unpaid one.
    if (kind === "receipt" && invoice.status !== "paid") {
      return res
        .status(409)
        .json({ error: "A receipt is only available once payment is confirmed." });
    }

    writeInvoicePdf(res, invoice, kind, await getBillingIdentity());
  } catch (error) {
    console.error("Invoice PDF error:", error);
    // The PDF streams into the response, so a failure after piping starts
    // cannot be turned into JSON.
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to render the invoice" });
    }
  }
}

async function getIdentity(req, res) {
  try {
    res.json(await getBillingIdentity());
  } catch (error) {
    fail(res, error, "Failed to load the billing identity");
  }
}

async function updateIdentity(req, res) {
  try {
    const next = await setBillingIdentity(req.body, req.user.userId);
    await recordAudit(req, "billing_identity_updated", null, {
      vat_registered: next.vat_registered,
      vat_rate: next.vat_rate,
    });
    res.json(next);
  } catch (error) {
    fail(res, error, "Failed to save the billing identity");
  }
}

module.exports = {
  getIdentity,
  updateIdentity,
  getSchoolEnrollments,
  getSchoolActivity,
  setSuspension,
  setBillingRate,
  previewInvoice,
  issueInvoice,
  listInvoices,
  updateInvoiceStatus,
  downloadInvoice,
};

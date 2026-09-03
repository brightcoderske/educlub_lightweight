const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { billable } = require("../src/services/schoolBilling.service");
const { money } = require("../src/services/invoicePdf.service");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

// ---------------------------------------------------------------- suspension

test("a suspended school is refused at every door into a session", () => {
  const auth = source("src/services/auth.service.js");

  // Three separate entry points create a session. A guard on login alone would
  // leave a teacher with a live refresh token working indefinitely, and one
  // mid-way through MFA able to finish signing in.
  for (const entry of ["login", "verify2FA", "refreshSession"]) {
    const start = auth.indexOf(`async function ${entry}(`);
    assert.notEqual(start, -1, `${entry} not found`);
    const next = auth.indexOf("\nasync function ", start + 1);
    const body = auth.slice(start, next === -1 ? auth.length : next);
    assert.match(
      body,
      /await assertSchoolNotSuspended\(user\)/,
      `${entry} lets a suspended school's user through`,
    );
  }
});

test("suspension keeps the school administrator, who is the one who can fix it", () => {
  const auth = source("src/services/auth.service.js");
  const start = auth.indexOf("async function assertSchoolNotSuspended(");
  const body = auth.slice(start, auth.indexOf("\nasync function ", start + 1));

  assert.match(body, /role === "school_admin"/);
  assert.match(body, /role === "system_admin"/);
  assert.match(body, /is_active === false/);
  assert.match(body, /statusCode = 403/);
});

test("the suspension check runs after the password, not before", () => {
  const auth = source("src/services/auth.service.js");
  const start = auth.indexOf("async function login(");
  const body = auth.slice(start, auth.indexOf("\nasync function ", start + 1));

  // Otherwise the error message tells an anonymous caller which schools are
  // suspended without them ever proving who they are.
  assert.ok(
    body.indexOf("bcrypt.compare") < body.indexOf("assertSchoolNotSuspended"),
    "school status is disclosed before credentials are verified",
  );
});

// ------------------------------------------------------------------- billing

test("a school with no rate is not billable rather than billed zero", () => {
  assert.equal(billable({ invoice_rate_per_learner: null }), null);
  assert.equal(billable({ invoice_rate_per_learner: 0 }), null);
  assert.equal(billable({ invoice_rate_per_learner: "not a number" }), null);
  assert.equal(billable({}), null);
  assert.equal(billable(undefined), null);
});

test("a positive rate is billable, including one given as a string by the driver", () => {
  assert.equal(billable({ invoice_rate_per_learner: 250 }), 250);
  assert.equal(billable({ invoice_rate_per_learner: "250.00" }), 250);
  assert.equal(billable({ invoice_rate_per_learner: 0.5 }), 0.5);
});

test("issuing refuses a school with no rate rather than sending a zero invoice", () => {
  const service = source("src/services/schoolBilling.service.js");
  const start = service.indexOf("async function issueInvoice(");
  const body = service.slice(start, service.indexOf("\nasync function ", start + 1));

  assert.match(body, /if \(!preview\.billable\)/);
  assert.match(body, /statusCode: 400/);
});

test("an invoice freezes its learner count and rate at issue time", () => {
  const service = source("src/services/schoolBilling.service.js");

  // Recomputing on read would let a learner enrolling next week change an
  // invoice that has already been sent.
  assert.match(service, /INSERT INTO school_invoices[\s\S]*learner_count, rate_per_learner, amount/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /status === "paid"/);
  assert.match(service, /statusCode: 409/);
});

test("amounts are rounded to the minor unit where the number is made", () => {
  const service = source("src/services/schoolBilling.service.js");
  assert.match(service, /Math\.round\(learnerCount \* rate \* 100\) \/ 100/);
});

test("money renders two decimals with the school's currency", () => {
  assert.equal(money(1500, "KES"), "KES 1,500.00");
  assert.equal(money(0, "KES"), "KES 0.00");
  assert.equal(money("2500.5", "USD"), "USD 2,500.50");
  assert.equal(money(null, "KES"), "KES 0.00");
});

// -------------------------------------------------------------------- routes

test("every custodian route is system-admin only and sits before the id route", () => {
  const routes = source("src/routes/schools.routes.js");

  for (const route of [
    "/:id/enrollments",
    "/:id/activity",
    "/:id/suspension",
    "/:id/billing-rate",
    "/:id/invoices",
  ]) {
    const line = routes.split("\n").find((text) => text.includes(`"${route}"`));
    assert.ok(line, `${route} is not mounted`);
  }

  assert.match(routes, /custody\.setSuspension/);
  assert.match(routes, /isSystemAdmin,\s*custody\.setSuspension/);

  // "/invoices" and "/invoices/:invoiceId/pdf" would otherwise be read as a
  // school whose id is the word "invoices".
  assert.ok(
    routes.indexOf('router.get("/invoices"') < routes.indexOf('router.get("/:id"'),
    "the invoices collection is shadowed by /:id",
  );
});

test("the activity feed reads the audit trail the app already writes", () => {
  const controller = source("src/controllers/schoolCustody.controller.js");

  assert.match(controller, /FROM audit_logs a/);
  // audit_logs records who acted, not where, so the school scope comes from the
  // acting user.
  assert.match(controller, /JOIN users u ON u\.id = a\.user_id/);
  assert.match(controller, /WHERE u\.school_id = \$1/);
  assert.match(controller, /LIMIT \$2/);
});

test("suspending and reinstating a school are both written to the audit trail", () => {
  const controller = source("src/controllers/schoolCustody.controller.js");
  assert.match(controller, /school_suspended/);
  assert.match(controller, /school_reinstated/);
  assert.match(controller, /school_invoice_issued/);
});

// ------------------------------------------------------------- VAT / receipts

const { totals } = require("../src/services/invoicePdf.service");
const { DEFAULT_VAT_RATE } = require("../src/services/billingIdentity.service");

test("Kenya's standard VAT rate is the default, not a hard-coded constant", () => {
  assert.equal(DEFAULT_VAT_RATE, 16);

  const service = source("src/services/billingIdentity.service.js");
  // A rate change has to be a setting, not a release.
  assert.match(service, /vat_rate/);
  assert.match(service, /rate >= 0 && rate <= 100/);
});

test("VAT is charged only when eduClub is registered for it", () => {
  const service = source("src/services/schoolBilling.service.js");
  const start = service.indexOf("async function previewInvoice(");
  const body = service.slice(start, service.indexOf("\nasync function ", start + 1));

  // An unregistered supplier charging VAT would be issuing an invalid tax
  // invoice.
  assert.match(body, /identity\.vat_registered === true/);
  assert.match(body, /const vatRate = vatApplied \? Number\(identity\.vat_rate\) \|\| 0 : 0/);
});

test("whether VAT applied is frozen onto the invoice, not read back from settings", () => {
  const service = source("src/services/schoolBilling.service.js");
  assert.match(service, /vat_applied = \$\d+, tax_percent = \$\d+/);
  assert.match(service, /vat_applied, tax_percent\)/);
});

test("totals apply discount before tax and leave a balance after payment", () => {
  const sums = totals({
    learner_count: 100,
    rate_per_learner: 500,
    discount_percent: 10,
    tax_percent: 16,
    amount_paid: 0,
    currency: "KES",
  });

  assert.equal(sums.subtotal, 50000);
  assert.equal(sums.discount, 5000);
  // VAT is charged on the discounted figure, not the gross one.
  assert.equal(sums.tax, 7200);
  assert.equal(sums.total, 52200);
  assert.equal(sums.balance, 52200);
});

test("an invoice with no VAT and no discount totals to its line amount", () => {
  const sums = totals({ learner_count: 40, rate_per_learner: 250, currency: "KES" });

  assert.equal(sums.subtotal, 10000);
  assert.equal(sums.tax, 0);
  assert.equal(sums.discount, 0);
  assert.equal(sums.total, 10000);
  assert.equal(sums.balance, 10000);
});

test("a paid invoice leaves no balance", () => {
  const sums = totals({
    learner_count: 10,
    rate_per_learner: 100,
    tax_percent: 16,
    amount_paid: 1160,
  });

  assert.equal(sums.total, 1160);
  assert.equal(sums.paid, 1160);
  assert.equal(sums.balance, 0);
});

test("a receipt cannot be printed before payment is confirmed", () => {
  const controller = source("src/controllers/schoolCustody.controller.js");
  const start = controller.indexOf("async function downloadInvoice(");
  const body = controller.slice(start, controller.indexOf("\nmodule.exports", start));

  assert.match(body, /kind === "receipt" && invoice\.status !== "paid"/);
  assert.match(body, /status\(409\)/);
});

test("the receipt number is issued when payment is confirmed and cleared if reversed", () => {
  const service = source("src/services/schoolBilling.service.js");
  const start = service.indexOf("async function setInvoiceStatus(");
  const body = service.slice(start, service.indexOf("\nmodule.exports", start));

  assert.match(body, /receipt_number = NULL/);
  assert.match(body, /invoice\.receipt_number \|\|/, "a reprinted receipt must keep its number");
  assert.match(body, /REC-/);
});

test("both parties' KRA PINs reach the rendered document", () => {
  const pdf = source("src/services/invoicePdf.service.js");

  assert.match(pdf, /issuer\.kra_pin/);
  assert.match(pdf, /invoice\.school_kra_pin/);
  // A VAT-registered supplier issues a "Tax Invoice", not an "Invoice".
  assert.match(pdf, /taxDocument \? "Tax Invoice" : "Invoice"/);

  const controller = source("src/controllers/schoolCustody.controller.js");
  assert.match(controller, /s\.kra_pin AS school_kra_pin/);
});

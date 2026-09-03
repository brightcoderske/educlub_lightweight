const PDFDocument = require("pdfkit");

const INK = "#101828";
const MUTED = "#667085";
const ACCENT = "#1aa3f0";
const RULE = "#e4e7ec";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(amount, currency) {
  return `${currency || "KES"} ${number(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function documentNumber(invoice, kind) {
  if (kind === "receipt") {
    return invoice.receipt_number || `REC-${String(invoice.id).padStart(4, "0")}`;
  }
  return `INV-${String(invoice.id).padStart(4, "0")}`;
}

/**
 * Every figure on the page derives from these, so the invoice and the receipt
 * can never disagree about what is owed.
 *
 * Discount comes off the line total first, tax applies to the discounted
 * figure, and the balance is what is left after payments. All three default to
 * zero, so an invoice with nothing configured still totals correctly.
 */
function totals(invoice) {
  const currency = invoice.currency || "KES";
  const subtotal = number(invoice.learner_count) * number(invoice.rate_per_learner);
  const discount = (subtotal * number(invoice.discount_percent)) / 100;
  const taxed = subtotal - discount;
  const tax = (taxed * number(invoice.tax_percent)) / 100;
  const total = Math.round((taxed + tax) * 100) / 100;
  const paid = Math.round(number(invoice.amount_paid) * 100) / 100;

  return {
    currency,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total,
    paid,
    balance: Math.round((total - paid) * 100) / 100,
  };
}

function documentFilename(invoice, kind) {
  const school = String(invoice.school_name || "school")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `educlub-${kind}-${school}-${documentNumber(invoice, kind).toLowerCase()}.pdf`;
}

function labelledRow(doc, label, value, y, { bold = false, colour = INK } = {}) {
  const right = doc.page.width - 54;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10).fillColor(colour);
  doc.text(label, right - 250, y, { width: 150, align: "right" });
  doc.text(value, right - 100, y, { width: 100, align: "right" });
  return y + (bold ? 18 : 15);
}

/**
 * Renders one school document straight to the response.
 *
 * `kind` is "invoice" (what is owed) or "receipt" (confirmation that it was
 * paid). They share a layout so a school sees the same figures twice rather
 * than two documents it has to reconcile.
 *
 * Every number comes off the stored row rather than being recomputed from
 * today's roll: a reprint of a document sent three months ago has to say what
 * it said then.
 */
function writeInvoicePdf(response, invoice, kind = "invoice", issuer = {}) {
  const isReceipt = kind === "receipt";
  // A VAT-registered supplier issues a "Tax Invoice", and it must show both
  // parties' PINs. Without VAT it is an ordinary invoice.
  const taxDocument = invoice.vat_applied === true && Number(invoice.tax_percent) > 0;
  const sums = totals(invoice);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, right: 54, bottom: 64, left: 54 },
    bufferPages: true,
    info: {
      Title: `eduClub ${kind} ${documentNumber(invoice, kind)} - ${invoice.school_name}`,
      Author: "eduClub",
      Subject: isReceipt ? "Payment receipt" : "School enrolment invoice",
    },
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${documentFilename(invoice, kind)}"`,
  );
  doc.pipe(response);

  const left = 54;
  const right = doc.page.width - 54;

  // ---- masthead: brand left, document type right
  doc.font("Helvetica-Bold").fontSize(30).fillColor(ACCENT).text("eduClub", left, 54);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Learn. Build. Practise. Compete.");

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor(INK)
    .text(isReceipt ? "Receipt" : taxDocument ? "Tax Invoice" : "Invoice", left, 54, {
      width: right - left,
      align: "right",
    });

  let metaY = 96;
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  const meta = [
    [isReceipt ? "Receipt no." : "Invoice no.", documentNumber(invoice, kind)],
    [isReceipt ? "Paid on" : "Invoice date", formatDate(isReceipt ? invoice.paid_at : invoice.issued_at)],
  ];
  if (!isReceipt) meta.push(["Due", formatDate(invoice.due_at)]);
  if (isReceipt && invoice.payment_method) meta.push(["Method", invoice.payment_method]);
  if (isReceipt && invoice.payment_reference) meta.push(["Reference", invoice.payment_reference]);
  if (issuer.kra_pin) meta.push(["Our KRA PIN", issuer.kra_pin]);

  for (const [label, value] of meta) {
    doc.fillColor(MUTED).text(label, right - 260, metaY, { width: 160, align: "right" });
    doc.fillColor(INK).text(value, right - 96, metaY, { width: 96, align: "right" });
    metaY += 14;
  }

  // ---- parties
  const partiesY = Math.max(metaY + 24, 170);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("From", left, partiesY);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(INK)
    .text(issuer.legal_name || "eduClub", left, partiesY + 12);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  doc.text(issuer.email || "support@educlub.co.ke", left, partiesY + 30);
  doc.text(issuer.address || "Nairobi, Kenya", left, partiesY + 42);
  if (issuer.kra_pin) doc.text(`KRA PIN: ${issuer.kra_pin}`, left, partiesY + 54);

  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  doc.text("Bill to", right - 240, partiesY, { width: 240, align: "right" });
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(INK)
    .text(invoice.school_name || "School", right - 240, partiesY + 12, {
      width: 240,
      align: "right",
    });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  if (invoice.school_email) {
    doc.text(invoice.school_email, right - 240, partiesY + 30, { width: 240, align: "right" });
  }
  if (invoice.school_phone) {
    doc.text(invoice.school_phone, right - 240, partiesY + 42, { width: 240, align: "right" });
  }
  if (invoice.school_kra_pin) {
    doc.text(`KRA PIN: ${invoice.school_kra_pin}`, right - 240, partiesY + 54, {
      width: 240,
      align: "right",
    });
  }

  // ---- line items
  const tableY = partiesY + 96;
  const columns = [
    ["DESCRIPTION", left, 210, "left"],
    ["RATE", left + 214, 70, "right"],
    ["QTY", left + 288, 50, "right"],
    ["TAX %", left + 342, 46, "right"],
    ["DISC. %", left + 392, 52, "right"],
    ["AMOUNT", left + 448, right - (left + 448), "right"],
  ];

  doc.rect(left, tableY, right - left, 22).fill(ACCENT);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  for (const [label, x, width, align] of columns) {
    doc.text(label, x + 6, tableY + 7, { width: width - 12, align });
  }

  const rowY = tableY + 30;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
  doc.text(`Enrolled learners - ${invoice.term} ${invoice.academic_year}`, left + 6, rowY, {
    width: 198,
  });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text("Billed per learner enrolled in the term shown.", left + 6, rowY + 13, { width: 198 });

  doc.font("Helvetica").fontSize(10).fillColor(INK);
  doc.text(number(invoice.rate_per_learner).toFixed(2), left + 220, rowY, {
    width: 58,
    align: "right",
  });
  doc.text(String(invoice.learner_count ?? 0), left + 294, rowY, { width: 38, align: "right" });
  doc.text(number(invoice.tax_percent).toFixed(0), left + 348, rowY, {
    width: 34,
    align: "right",
  });
  doc.text(number(invoice.discount_percent).toFixed(0), left + 398, rowY, {
    width: 40,
    align: "right",
  });
  doc.text(sums.subtotal.toFixed(2), left + 454, rowY, {
    width: right - (left + 460),
    align: "right",
  });

  doc
    .moveTo(left, rowY + 34)
    .lineTo(right, rowY + 34)
    .strokeColor(RULE)
    .stroke();

  // ---- totals
  let y = rowY + 48;
  y = labelledRow(doc, "Subtotal", money(sums.subtotal, sums.currency), y);
  if (sums.discount > 0) {
    y = labelledRow(doc, `Discount (${number(invoice.discount_percent)}%)`, `- ${money(sums.discount, sums.currency)}`, y, { colour: MUTED });
  }
  if (sums.tax > 0) {
    y = labelledRow(
      doc,
      `${taxDocument ? "VAT" : "Tax"} (${number(invoice.tax_percent)}%)`,
      money(sums.tax, sums.currency),
      y,
      { colour: MUTED },
    );
  }
  y = labelledRow(doc, "Total", money(sums.total, sums.currency), y, { bold: true });
  y = labelledRow(doc, "Amount paid", money(sums.paid, sums.currency), y, { colour: MUTED });

  doc.rect(right - 250, y - 2, 250, 26).fill(isReceipt ? "#e7f7ee" : "#eaf6fe");
  labelledRow(
    doc,
    isReceipt ? "Paid in full" : "Balance due",
    money(isReceipt ? sums.paid : sums.balance, sums.currency),
    y + 5,
    { bold: true, colour: isReceipt ? "#12855b" : INK },
  );

  // ---- payment instruction / notes
  const footerY = y + 60;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Payment instruction", left, footerY);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  doc.text("M-Pesa or bank transfer to eduClub.", left, footerY + 14, { width: 250 });
  doc.text("Quote the document number above when paying.", left, footerY + 26, { width: 250 });

  if (invoice.notes) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Notes", left, footerY + 50);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(invoice.notes, left, footerY + 64, {
      width: 250,
    });
  }

  doc.font("Helvetica").fontSize(8).fillColor("#98a2b3");
  doc.text(
    isReceipt
      ? "This receipt confirms payment received in full for the term shown."
      : taxDocument
        ? "Tax invoice. Learner numbers are those recorded when this invoice was issued."
        : "Learner numbers are those recorded when this invoice was issued.",
    left,
    doc.page.height - 84,
    { width: right - left },
  );

  doc.end();
}

module.exports = { writeInvoicePdf, documentFilename, documentNumber, totals, money };

const PDFDocument = require("pdfkit");

const HIDDEN_KEYS = new Set([
  "answer",
  "answers",
  "answer_key",
  "answerKey",
  "correct_answer",
  "correctAnswer",
  "correct_answers",
  "correctAnswers",
  "correct",
  "is_correct",
  "isCorrect",
  "solution",
  "solutions",
]);

const INTERNAL_KEYS = new Set([
  "id",
  "template_activity_id",
  "template_module_id",
  "position",
  "is_published",
  "is_required",
  "availability_mode",
  "completion_rule",
  "pass_score",
  "status",
  "score",
  "completed_at",
  "progress_updated_at",
  "is_unlocked",
  "lock_reason",
]);

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sanitizeValue(value, shuffleItems) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, shuffleItems));
  }
  if (!value || typeof value !== "object") return value;

  const sanitized = {};
  Object.entries(value).forEach(([key, child]) => {
    if (HIDDEN_KEYS.has(key)) return;
    if (key === "explanation" && value.question_type) return;

    const cleanChild = sanitizeValue(child, shuffleItems);
    if (
      key === "options" &&
      value.question_type === "ordering" &&
      Array.isArray(cleanChild)
    ) {
      sanitized[key] = shuffleItems(cleanChild);
    } else {
      sanitized[key] = cleanChild;
    }
  });
  return sanitized;
}

function prepareModuleForPdf(moduleLearning, shuffleItems = shuffle) {
  return sanitizeValue(moduleLearning, shuffleItems);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function modulePdfFilename(courseName, moduleTitle) {
  return `educlub-${slug(courseName) || "course"}-${slug(moduleTitle) || "module"}.pdf`;
}

function labelFor(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ensureRoom(doc, height = 55) {
  if (doc.y + height > doc.page.height - 70) doc.addPage();
}

function renderPrimitive(doc, value, indent = 0, bullet = null) {
  if (value === null || value === undefined || value === "") return;
  ensureRoom(doc);
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor("#263238")
    .text(`${bullet ? `${bullet} ` : ""}${String(value)}`, 54 + indent, doc.y, {
      width: doc.page.width - 108 - indent,
      lineGap: 2,
    });
  doc.moveDown(0.35);
}

function renderContent(doc, value, depth = 0) {
  if (value === null || value === undefined || value === "") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item && typeof item === "object") {
        ensureRoom(doc, 45);
        doc
          .font("Helvetica-Bold")
          .fontSize(10.5)
          .fillColor("#1565c0")
          .text(`Item ${index + 1}`, 54 + depth * 12);
        renderContent(doc, item, depth + 1);
      } else {
        renderPrimitive(doc, item, depth * 12, "•");
      }
    });
    return;
  }

  if (typeof value !== "object") {
    renderPrimitive(doc, value, depth * 12);
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
    if (INTERNAL_KEYS.has(key) || child === null || child === undefined || child === "") {
      return;
    }
    ensureRoom(doc, 42);
    doc
      .font("Helvetica-Bold")
      .fontSize(depth === 0 ? 11.5 : 10.5)
      .fillColor("#37474f")
      .text(labelFor(key), 54 + depth * 12, doc.y, {
        width: doc.page.width - 108 - depth * 12,
      });
    doc.moveDown(0.2);
    renderContent(doc, child, depth + 1);
  });
}

function addPageBranding(doc, courseName, moduleTitle) {
  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    doc
      .save()
      .moveTo(54, doc.page.height - 42)
      .lineTo(doc.page.width - 54, doc.page.height - 42)
      .strokeColor("#dbeafe")
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#546e7a")
      .text(
        `eduClub | ${courseName} | ${moduleTitle}`,
        54,
        doc.page.height - 33,
        { width: doc.page.width - 135, lineBreak: false },
      )
      .text(`Page ${pageIndex + 1}`, doc.page.width - 105, doc.page.height - 33, {
        width: 51,
        align: "right",
        lineBreak: false,
      })
      .restore();
  }
}

function writeModulePdf(response, moduleLearning) {
  const prepared = prepareModuleForPdf(moduleLearning);
  const courseName = prepared.course?.name || prepared.course?.title || "Course";
  const moduleTitle = prepared.module?.title || "Module";
  const filename = modulePdfFilename(courseName, moduleTitle);
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, right: 54, bottom: 64, left: 54 },
    bufferPages: true,
    info: {
      Title: `${courseName} - ${moduleTitle}`,
      Author: "eduClub",
      Subject: "Module learning activities",
    },
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(response);

  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor("#0d47a1")
    .text("eduClub");
  doc.moveDown(0.35);
  doc.fontSize(17).fillColor("#263238").text(courseName);
  doc.moveDown(0.2);
  doc.fontSize(14).fillColor("#1565c0").text(moduleTitle);

  if (prepared.module?.description) {
    doc.moveDown(0.75);
    renderPrimitive(doc, prepared.module.description);
  }

  if (prepared.module?.learning_outcomes?.length) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#263238").text("Learning Objectives");
    renderContent(doc, prepared.module.learning_outcomes);
  }

  (prepared.module?.activities || []).forEach((activity, index) => {
    ensureRoom(doc, 100);
    doc.moveDown(0.8);
    doc
      .roundedRect(54, doc.y, doc.page.width - 108, 28, 5)
      .fill("#e3f2fd");
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#0d47a1")
      .text(`Activity ${index + 1}: ${activity.title || "Activity"}`, 64, doc.y - 21, {
        width: doc.page.width - 128,
      });
    doc.moveDown(1.1);
    renderContent(doc, activity.content || {});
  });

  addPageBranding(doc, courseName, moduleTitle);
  doc.end();
}

module.exports = {
  prepareModuleForPdf,
  modulePdfFilename,
  writeModulePdf,
};

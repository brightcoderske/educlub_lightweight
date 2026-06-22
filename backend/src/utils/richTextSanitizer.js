const ALLOWED_DATA_ATTRIBUTES = new Set([
  "data-code-language",
  "data-code-title",
  "data-display-code",
  "data-executable-code",
  "data-hint-block",
  "data-hint-body",
  "data-hint-title",
  "data-interactive-answer",
  "data-interactive-block",
  "data-interactive-toggle",
  "data-block-answer",
  "data-block-prompt",
  "data-block-title",
  "data-celebrate",
  "data-correct",
  "data-flashcard",
  "data-hint-panel",
  "data-hint-toggle",
  "data-quiz-feedback",
  "data-quiz-option",
  "data-rich-check",
  "data-rich-key",
  "data-rich-progress",
  "data-rich-progress-fill",
  "data-rich-progress-text",
  "data-rich-quiz",
  "data-rich-reflection",
  "data-rich-root",
  "data-sort-check",
  "data-sort-index",
  "data-sort-reset",
  "data-sort-status",
  "data-sorter",
]);

const URI_ATTRIBUTES = new Set(["href", "src"]);

function isSafeUri(value = "") {
  const trimmed = String(value).trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  return /^(https?:|mailto:|tel:|data:image\/(?:png|jpeg|jpg|gif|webp);base64,|\/uploads\/|\/)/i.test(
    trimmed,
  );
}

function sanitizeStyle(value = "") {
  return String(value)
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*(['"]?)javascript:[^)]+\)/gi, "");
}

function sanitizeAttributes(attributes = "") {
  return String(attributes).replace(
    /\s([a-zA-Z0-9:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
    (match, rawName, rawValue, doubleQuoted, singleQuoted, bareValue) => {
      const name = rawName.toLowerCase();
      const value = doubleQuoted ?? singleQuoted ?? bareValue ?? "";

      if (name.startsWith("on")) return "";
      if (name === "style") {
        return ` style="${sanitizeStyle(value).replace(/"/g, "&quot;")}"`;
      }
      if (name === "contenteditable") return match;
      if (name.startsWith("data-") && !ALLOWED_DATA_ATTRIBUTES.has(name)) return "";
      if (URI_ATTRIBUTES.has(name) && !isSafeUri(value)) return "";
      if (name === "srcdoc") return "";

      return ` ${name}="${String(value).replace(/"/g, "&quot;")}"`;
    },
  );
}

function sanitizeRichHtml(html = "") {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[\s\S]*?<\/embed>/gi, "")
    .replace(/<form\b[\s\S]*?<\/form>/gi, "")
    .replace(/<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (tag, name, attributes) => {
      return `<${name.toLowerCase()}${sanitizeAttributes(attributes)}>`;
    });
}

function sanitizeActivityContent(content = {}) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return content || {};
  }
  return {
    ...content,
    rich_html:
      typeof content.rich_html === "string"
        ? sanitizeRichHtml(content.rich_html)
        : content.rich_html,
  };
}

module.exports = { sanitizeActivityContent, sanitizeRichHtml };

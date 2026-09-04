export const DEFAULT_SUBMISSION_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function metadataText(value, separator) {
  return Array.isArray(value) ? value.filter(Boolean).join(separator) : value || "";
}

export function selectActivityContent(content = {}, quizResult = {}) {
  const feedback = quizResult.feedback || {};
  return {
    media: content.media || {},
    hints: content.friendly_hints || [],
    levelUp: content.level_up || content.project_brief || "",
    badgeName: content.module_badge?.name || "",
    submission: {
      accept: metadataText(content.submission_accept, ",") || DEFAULT_SUBMISSION_ACCEPT,
      help: metadataText(content.submission_help, " "),
    },
    questionFeedback: Object.fromEntries(
      (content.questions || []).map((question) => [
        question.id,
        {
          hint: feedback[question.id]?.hint || question.hint || "",
          explanation: feedback[question.id]?.explanation || "",
          correct: feedback[question.id]?.correct,
        },
      ])
    ),
  };
}

export function starterCode(content = {}) {
  if (content.starter_code || content.code) return content.starter_code || content.code;
  return [
    content.starter_html || "",
    content.starter_css ? `<style>\n${content.starter_css}\n</style>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function starterParts(content = {}) {
  if (content.starter_html || content.starter_css || content.starter_js) {
    const parts = {
      html: content.starter_html || "",
      css: content.starter_css || "",
    };
    if (content.starter_js !== undefined) parts.js = content.starter_js || "";
    return parts;
  }
  return {
    html: content.starter_code || content.code || "",
    css: "",
  };
}

/**
 * Whether an activity's code workspace should run JavaScript.
 *
 * `language` and `starter_js` come from the same authored content blob, written
 * by the same staff member through the same sanitizer, so neither is more
 * trusted than the other. Requiring both to agree bought no safety and silently
 * broke activities: content carrying starter_js under language "html_css" ran
 * with the script dropped, so the learner met dead buttons and no explanation.
 * Treating either signal as the author's intent removes that trap.
 *
 * The sandbox itself is unchanged - still `allow-scripts` with no
 * `allow-same-origin`, under the CSP webPreview writes - so scripts stay walled
 * off from the app's origin, storage and network.
 */
export function scriptsAllowed(content = {}) {
  if ((content.language || "").toLowerCase() === "html_css_js") return true;
  return typeof content.starter_js === "string" && content.starter_js.trim() !== "";
}

/** Languages whose activities get the HTML/CSS editor panels. */
export function hasCodeWorkspace(content = {}) {
  const language = (content.language || "").toLowerCase();
  return ["html_css", "html_css_js"].includes(language);
}

export function webPreview(html = "", css = "", js = "", allowJavaScript = false) {
  if (typeof js === "boolean") {
    allowJavaScript = js;
    js = "";
  }
  const safeHtml = allowJavaScript ? html : html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const policy =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:\">";
  return `${policy}${safeHtml}${css ? `<style>${css}</style>` : ""}${
    allowJavaScript && js ? `<script>${js}<\/script>` : ""
  }`;
}

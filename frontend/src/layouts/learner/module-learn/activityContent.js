export function selectActivityContent(content = {}, quizResult = {}) {
  const feedback = quizResult.feedback || {};
  return {
    media: content.media || {},
    hints: content.friendly_hints || [],
    levelUp: content.level_up || content.project_brief || "",
    badgeName: content.module_badge?.name || "",
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

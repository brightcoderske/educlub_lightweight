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
      ]),
    ),
  };
}

export function starterCode(content = {}) {
  if (content.starter_code || content.code) return content.starter_code || content.code;
  return [
    content.starter_html || "",
    content.starter_css ? `<style>\n${content.starter_css}\n</style>` : "",
  ].filter(Boolean).join("\n");
}

export function starterParts(content = {}) {
  if (content.starter_html || content.starter_css) {
    return {
      html: content.starter_html || "",
      css: content.starter_css || "",
    };
  }
  return {
    html: content.starter_code || content.code || "",
    css: "",
  };
}

export function webPreview(html = "", css = "", allowJavaScript = false) {
  const safeHtml = allowJavaScript
    ? html
    : html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return `${safeHtml}${css ? `<style>${css}</style>` : ""}`;
}

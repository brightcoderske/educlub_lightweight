export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeHttpUrl(value) {
  const url = String(value || "").trim();
  let parsed;

  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error("Enter a complete HTTP or HTTPS URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }

  return parsed.toString();
}

export function resourceHtml({ type, url, label = "", alt = "" }) {
  const safeUrl = escapeHtml(normalizeHttpUrl(url));

  if (type === "image") {
    return `<img src="${safeUrl}" alt="${escapeHtml(
      alt
    )}" style="max-width:70%;height:auto;cursor:pointer" />`;
  }

  const text = escapeHtml(label.trim() || (type === "link" ? "Open link" : "Open resource"));
  if (type === "link") {
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  }

  return `<p><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;text-decoration:none">${text}</a></p>`;
}

export function splitExecutableSource(source = "") {
  let html = String(source);
  const css = [];
  const js = [];

  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, content) => {
    css.push(content.trim());
    return "";
  });
  html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, content) => {
    js.push(content.trim());
    return "";
  });

  return {
    html: html.trim(),
    css: css.filter(Boolean).join("\n\n"),
    js: js.filter(Boolean).join("\n\n"),
  };
}

export function executableSourceFromPayload(encodedPayload = "") {
  if (!encodedPayload) return "";

  try {
    const payload = JSON.parse(decodeURIComponent(encodedPayload));
    return [
      payload.css ? `<style>\n${payload.css}\n</style>` : "",
      payload.html || "",
      payload.js ? `<script>\n${payload.js}\n</script>` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  } catch (error) {
    return "";
  }
}

export function executableBlockHtml({ source = "", title = "Executable web code" }) {
  const payload = encodeURIComponent(JSON.stringify(splitExecutableSource(source)));
  return `<div data-executable-code="${payload}" data-code-title="${escapeHtml(
    title
  )}" contenteditable="false" style="border:1px solid #cbd5e1;padding:12px;border-radius:8px;background:#f8fafc"><strong>${escapeHtml(
    title
  )}</strong><pre style="background:#111827;color:#e5e7eb;padding:10px;border-radius:6px;overflow:auto">${escapeHtml(
    source
  )}</pre><span style="color:#475569">Learners select Run to reveal the output.</span></div><p><br></p>`;
}

export function displayCodeBlockHtml({ code = "", language = "text", title = "" }) {
  return `<pre data-display-code="true" data-code-language="${escapeHtml(
    language
  )}" data-code-title="${escapeHtml(
    title
  )}" style="background:#111827;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto">${
    title
      ? `<strong style="display:block;color:#ffffff;margin-bottom:8px">${escapeHtml(
          title
        )}</strong>`
      : ""
  }<code>${escapeHtml(code)}</code></pre><p><br></p>`;
}

export function hintBlockHtml({ title = "Need a hint?", body = "" }) {
  return `<details data-hint-block="true" data-hint-title="${escapeHtml(
    title
  )}" data-hint-body="${escapeHtml(
    body
  )}" contenteditable="false" style="margin:12px 0;padding:12px;border:1px solid #fbbf24;border-radius:8px;background:#fffbeb"><summary style="cursor:pointer;font-weight:700;color:#92400e">${escapeHtml(
    title
  )}</summary><div style="margin-top:8px;color:#475569;white-space:pre-wrap">${escapeHtml(
    body
  )}</div></details><p><br></p>`;
}

export function buildEarlyUnlockPayload({
  scopeType,
  learnerIds = [],
  moduleId,
  activityId = null,
  grade = "",
  stream = "",
  reason,
}) {
  const cleanReason = String(reason || "").trim();
  if (!cleanReason) throw new Error("Add a reason for the early unlock.");
  if (!moduleId) throw new Error("Choose a module to unlock.");

  const payload = {
    scope_type: scopeType,
    module_id: moduleId,
    activity_id: activityId || null,
    reason: cleanReason,
  };
  const ids = learnerIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);

  if (scopeType === "learner") {
    if (ids.length !== 1) throw new Error("Choose one learner.");
    payload.learner_id = ids[0];
  } else if (scopeType === "learners") {
    if (ids.length === 0) throw new Error("Choose at least one learner.");
    payload.learner_ids = [...new Set(ids)];
  } else if (scopeType === "class") {
    if (grade.trim()) payload.grade = grade.trim();
    if (stream.trim()) payload.stream = stream.trim();
  } else {
    throw new Error("Choose who should receive the early unlock.");
  }

  return payload;
}

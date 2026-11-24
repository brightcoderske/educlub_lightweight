import { sanitizeClicked, sanitizePageFields } from "../../../python-runner/protocol";

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

/** What every editor of a coding activity holds before the learner types. */
export function starterWorkspace(content = {}) {
  const parts = starterParts(content);
  return {
    code: starterCode(content),
    html: parts.html,
    css: parts.css,
    js: parts.js || "",
  };
}

/**
 * Whether an activity's code workspace shows its own JavaScript box.
 *
 * `language` and `starter_js` come from the same authored content blob, written
 * by the same staff member through the same sanitizer, so either one is taken
 * as the author's intent. Scripts written inside the HTML box run in every web
 * preview either way (see PREVIEW_SANDBOX).
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

export function isPythonActivity(content = {}) {
  return (content.language || "").trim().toLowerCase() === "python";
}

/**
 * Python + HTML activities: the learner builds a page in HTML and CSS and
 * writes the program in Python. Buttons on the page run the Python, and what
 * it prints appears in the page's #output element.
 */
export function isPythonWebActivity(content = {}) {
  return (content.language || "").trim().toLowerCase() === "python_html";
}

export const PREVIEW_MIN_HEIGHT = 320;
export const PREVIEW_MAX_HEIGHT = 2000;

/**
 * Reports the preview's own height to the parent so the frame can grow with
 * its content instead of scrolling inside a fixed 320px box.
 *
 * The frame is sandboxed without `allow-same-origin`, so it is an opaque
 * origin and the parent cannot read its document height directly. It has to
 * volunteer it. postMessage crosses that boundary; nothing else needs to.
 *
 * It re-measures on resize and on a few short delays, because emoji, fonts and
 * images all land after first paint and each one changes the height.
 */
const AUTO_HEIGHT_REPORTER = `
(function () {
  var last = 0;
  function report() {
    var d = document.documentElement, b = document.body;
    if (!b) return;
    var h = Math.max(b.scrollHeight, b.offsetHeight, d ? d.scrollHeight : 0);
    if (!h || Math.abs(h - last) < 4) return;
    last = h;
    try { parent.postMessage({ source: "educlub-preview", height: h }, "*"); } catch (e) {}
  }
  if (typeof ResizeObserver === "function") {
    try { new ResizeObserver(report).observe(document.documentElement); } catch (e) {}
  }
  window.addEventListener("load", report);
  [0, 60, 200, 600, 1200].forEach(function (t) { setTimeout(report, t); });
  document.addEventListener("click", function () { setTimeout(report, 0); }, true);
  document.addEventListener("input", function () { setTimeout(report, 0); }, true);
})();`;

/**
 * Grows `frame` to fit whatever it is showing, within sane bounds.
 *
 * Only messages from this exact frame are honoured. The frame is an opaque
 * origin so `event.origin` is the string "null" and cannot identify anyone -
 * `event.source` identity is the check that actually means something here.
 * Returns a cleanup function.
 */
export function attachPreviewAutoHeight(
  frame,
  { min = PREVIEW_MIN_HEIGHT, max = PREVIEW_MAX_HEIGHT } = {}
) {
  // Take the view from the frame itself rather than a global, so this works in
  // any document the frame happens to live in.
  const view = frame && frame.ownerDocument && frame.ownerDocument.defaultView;
  if (!frame || !view) return () => {};
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== "educlub-preview") return;
    const height = Number(data.height);
    if (!Number.isFinite(height)) return;
    frame.style.height = `${Math.min(max, Math.max(min, Math.ceil(height) + 24))}px`;
  };
  view.addEventListener("message", onMessage);
  return () => view.removeEventListener("message", onMessage);
}

/**
 * What a preview frame may do. A learner's page behaves like a real web page:
 * its scripts run, alert() and prompt() show, a form's submit event fires, and
 * an outside link opens in a new tab.
 *
 * `allow-same-origin` is the one thing it never gets. Without it the frame is
 * an opaque origin: it cannot read eduClub's page, storage or session, and the
 * session cookie (SameSite=Lax) is not sent on its requests, so reaching the
 * internet does not reach the learner's account.
 */
export const PREVIEW_SANDBOX =
  "allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox";

/**
 * Pictures, sounds, fonts, stylesheets, libraries and fetch() may come from
 * any https address, so a learner sees the image they linked and can call a
 * public API. A form still never leaves the page (form-action 'none'): its
 * submit event runs the learner's script, and a form without one stays put.
 */
const PREVIEW_POLICY = `<meta http-equiv="Content-Security-Policy" content="${[
  "default-src 'none'",
  "script-src 'unsafe-inline' https:",
  "style-src 'unsafe-inline' https:",
  "img-src https: data: blob:",
  "media-src https: data: blob:",
  "font-src https: data:",
  "connect-src https:",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ")}">`;

/**
 * Runs before the learner's code. An outside link opens in a new tab: inside
 * the frame most sites refuse to show at all, and the learner's page would be
 * gone until they pressed Run again. `#section` links still scroll the page.
 *
 * localStorage throws in an opaque frame, which stopped a whole script at its
 * first line. It is swapped for one kept in memory: it works the same way,
 * and it empties when Run starts the page again.
 */
const PAGE_HELPER = `
(function () {
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link || event.defaultPrevented) return;
    var href = link.getAttribute("href") || "";
    if (href.charAt(0) === "#" || /^javascript:/i.test(href)) return;
    link.target = "_blank";
    link.rel = "noopener";
  });
  function memoryStorage() {
    var items = {};
    return {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null; },
      setItem: function (key, value) { items[key] = String(value); },
      removeItem: function (key) { delete items[key]; },
      clear: function () { items = {}; },
      key: function (index) { return Object.keys(items)[index] || null; },
      get length() { return Object.keys(items).length; }
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try { window[name].length; } catch (e) {
      try { Object.defineProperty(window, name, { value: memoryStorage(), configurable: true }); } catch (ignored) {}
    }
  });
})();`;

const PAGE_HELPER_TAG = `<script>${PAGE_HELPER}<\/script>`;

export function webPreview(html = "", css = "", js = "") {
  return `${PREVIEW_POLICY}${PAGE_HELPER_TAG}${html}${css ? `<style>${css}</style>` : ""}${
    js ? `<script>${js}<\/script>` : ""
  }<script>${AUTO_HEIGHT_REPORTER}<\/script>`;
}

export const PYTHON_PAGE_SOURCE = "educlub-python-page";

/**
 * Runs inside a Python + HTML page. It is the page's only script: learner
 * <script> tags are stripped, because the program is the Python.
 *
 * A button click (or Enter in a text box) sends every field's value, keyed by
 * its name or id, to the app, which runs the learner's Python in the isolated
 * runner and sends back HTML for #output. The page also asks for one run as it
 * loads, so a program can fill the page before anything is clicked. Python
 * never touches this document; it only returns text.
 */
const PYTHON_PAGE_BRIDGE = `
(function () {
  var SOURCE = "${PYTHON_PAGE_SOURCE}";
  var shown = false;
  function outputBox() {
    var el = document.getElementById("output");
    if (!el) { el = document.createElement("div"); el.id = "output"; document.body.appendChild(el); }
    return el;
  }
  function fields() {
    var values = {};
    var els = document.querySelectorAll("input, select, textarea");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.name || el.id;
      if (!key || el.type === "button" || el.type === "submit") continue;
      if (el.type === "checkbox") values[key] = el.checked ? "yes" : "no";
      else if (el.type === "radio") { if (el.checked) values[key] = el.value; else if (!(key in values)) values[key] = ""; }
      else values[key] = el.value;
    }
    return values;
  }
  function label(button) {
    return button.id || button.name || (button.value || button.textContent || "").trim();
  }
  function run(clicked) {
    try { parent.postMessage({ source: SOURCE, type: "run", fields: fields(), clicked: clicked }, "*"); } catch (e) {}
  }
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest
      ? event.target.closest("button, input[type=button], input[type=submit]") : null;
    if (!button) return;
    event.preventDefault();
    run(label(button));
  }, true);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || !event.target || event.target.tagName !== "INPUT") return;
    event.preventDefault();
    var first = document.querySelector("button, input[type=button], input[type=submit]");
    run(first ? label(first) : "");
  });
  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.source !== SOURCE) return;
    if (data.type === "hello") { if (!shown) run(""); return; }
    if (data.type !== "show") return;
    shown = true;
    outputBox().innerHTML = String(data.html || "");
  });
  run("");
})();`;

/**
 * The document for a Python + HTML page. `nonce` makes every Run a new
 * document, so pressing Run again always reloads the page fresh.
 */
export function pythonWebPreview(html = "", css = "", nonce = 0) {
  const safeHtml = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "");
  return `${PREVIEW_POLICY}${PAGE_HELPER_TAG}<!-- run ${Number(nonce) || 0} -->${safeHtml}${
    css ? `<style>${css}</style>` : ""
  }<script>${PYTHON_PAGE_BRIDGE}<\/script><script>${AUTO_HEIGHT_REPORTER}<\/script>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * What a run puts in the page's #output. Printed HTML is shown as HTML; plain
 * printed text keeps its line breaks; errors appear as a readable red box, so
 * a mistake shows up right where the learner is looking.
 */
export function pythonWebHtml(result = {}) {
  const printed = String(result.stdout || "");
  let html = "";
  if (printed) {
    html = /<[a-z!/][^>]*>/i.test(printed)
      ? printed
      : `<pre style="white-space:pre-wrap;margin:0;font:inherit">${escapeHtml(printed)}</pre>`;
  }
  const problem = [result.stderr, result.error].filter(Boolean).join("\n");
  if (problem) {
    html += `<pre style="white-space:pre-wrap;margin:8px 0 0;padding:10px 12px;border-radius:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;font:13px/1.5 ui-monospace,monospace">${escapeHtml(
      problem
    )}</pre>`;
  }
  return html;
}

/**
 * Connects a Python + HTML preview frame to `onRun`, which receives
 * { fields, clicked } and resolves to the HTML for #output.
 *
 * Only messages from this exact frame count (its origin is opaque, so
 * `event.source` is the real check). Field data is sanitized before it goes
 * anywhere. Clicks that arrive while a run is in progress are dropped rather
 * than queued, so hammering a button cannot pile up runs. Returns a cleanup.
 */
export function attachPythonWebBridge(frame, onRun) {
  const view = frame && frame.ownerDocument && frame.ownerDocument.defaultView;
  if (!frame || !view || typeof onRun !== "function") return () => {};
  let active = true;
  let running = false;
  const post = (message) => {
    if (active && frame.contentWindow) {
      frame.contentWindow.postMessage({ source: PYTHON_PAGE_SOURCE, ...message }, "*");
    }
  };
  const onMessage = async (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== PYTHON_PAGE_SOURCE || data.type !== "run" || running) return;
    running = true;
    try {
      const html = await onRun({
        fields: Object.fromEntries(sanitizePageFields(data.fields)),
        clicked: sanitizeClicked(data.clicked),
      });
      post({ type: "show", html: String(html ?? "") });
    } catch (error) {
      post({
        type: "show",
        html: pythonWebHtml({ error: error?.message || "Python could not run this program." }),
      });
    } finally {
      running = false;
    }
  };
  view.addEventListener("message", onMessage);
  // If the page loaded before this listener existed, its first request was
  // lost; this asks it to try again (it ignores the hello once it has output).
  post({ type: "hello" });
  return () => {
    active = false;
    view.removeEventListener("message", onMessage);
  };
}

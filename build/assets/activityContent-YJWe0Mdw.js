import{d as e,l as t}from"./protocol-Qu_NSNkN.js";function n(e,t){return Array.isArray(e)?e.filter(Boolean).join(t):e||``}function r(e={},t={}){let r=t.feedback||{};return{media:e.media||{},hints:e.friendly_hints||[],levelUp:e.level_up||e.project_brief||``,badgeName:e.module_badge?.name||``,submission:{accept:n(e.submission_accept,`,`)||`image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`,help:n(e.submission_help,` `)},questionFeedback:Object.fromEntries((e.questions||[]).map(e=>[e.id,{hint:r[e.id]?.hint||e.hint||``,explanation:r[e.id]?.explanation||``,correct:r[e.id]?.correct}]))}}function i(e={}){return e.starter_code||e.code?e.starter_code||e.code:[e.starter_html||``,e.starter_css?`<style>\n${e.starter_css}\n</style>`:``].filter(Boolean).join(`
`)}function a(e={}){if(e.starter_html||e.starter_css||e.starter_js){let t={html:e.starter_html||``,css:e.starter_css||``};return e.starter_js!==void 0&&(t.js=e.starter_js||``),t}return{html:e.starter_code||e.code||``,css:``}}function o(e={}){let t=a(e);return{code:i(e),html:t.html,css:t.css,js:t.js||``}}function s(e={}){return(e.language||``).toLowerCase()===`html_css_js`||typeof e.starter_js==`string`&&e.starter_js.trim()!==``}function c(e={}){let t=(e.language||``).toLowerCase();return[`html_css`,`html_css_js`].includes(t)}function l(e={}){return(e.language||``).trim().toLowerCase()===`python`}function u(e={}){return(e.language||``).trim().toLowerCase()===`python_html`}var d=2e3,f=`
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
})();`;function p(e,{min:t=320,max:n=d}={}){let r=e&&e.ownerDocument&&e.ownerDocument.defaultView;if(!e||!r)return()=>{};let i=r=>{if(r.source!==e.contentWindow)return;let i=r.data;if(!i||i.source!==`educlub-preview`)return;let a=Number(i.height);Number.isFinite(a)&&(e.style.height=`${Math.min(n,Math.max(t,Math.ceil(a)+24))}px`)};return r.addEventListener(`message`,i),()=>r.removeEventListener(`message`,i)}var m=`allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox`,h=`<meta http-equiv="Content-Security-Policy" content="${[`default-src 'none'`,`script-src 'unsafe-inline' https:`,`style-src 'unsafe-inline' https:`,`img-src https: data: blob:`,`media-src https: data: blob:`,`font-src https: data:`,`connect-src https:`,`form-action 'none'`,`base-uri 'none'`].join(`; `)}">`,g=`<script>
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
})();<\/script>`;function _(e=``,t=``,n=``){return`${h}${g}${e}${t?`<style>${t}</style>`:``}${n?`<script>${n}<\/script>`:``}<script>${f}<\/script>`}var v=`educlub-python-page`,y=`
(function () {
  var SOURCE = "${v}";
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
})();`;function b(e=``,t=``,n=0){let r=String(e).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,``).replace(/<\/?script\b[^>]*>/gi,``);return`${h}${g}<!-- run ${Number(n)||0} -->${r}${t?`<style>${t}</style>`:``}<script>${y}<\/script><script>${f}<\/script>`}function x(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function S(e={}){let t=String(e.stdout||``),n=``;t&&(n=/<[a-z!/][^>]*>/i.test(t)?t:`<pre style="white-space:pre-wrap;margin:0;font:inherit">${x(t)}</pre>`);let r=[e.stderr,e.error].filter(Boolean).join(`
`);return r&&(n+=`<pre style="white-space:pre-wrap;margin:8px 0 0;padding:10px 12px;border-radius:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;font:13px/1.5 ui-monospace,monospace">${x(r)}</pre>`),n}function C(n,r){let i=n&&n.ownerDocument&&n.ownerDocument.defaultView;if(!n||!i||typeof r!=`function`)return()=>{};let a=!0,o=!1,s=e=>{a&&n.contentWindow&&n.contentWindow.postMessage({source:v,...e},`*`)},c=async i=>{if(i.source!==n.contentWindow)return;let a=i.data;if(!(!a||a.source!==`educlub-python-page`||a.type!==`run`||o)){o=!0;try{let n=await r({fields:Object.fromEntries(e(a.fields)),clicked:t(a.clicked)});s({type:`show`,html:String(n??``)})}catch(e){s({type:`show`,html:S({error:e?.message||`Python could not run this program.`})})}finally{o=!1}}};return i.addEventListener(`message`,c),s({type:`hello`}),()=>{a=!1,i.removeEventListener(`message`,c)}}export{l as a,b as c,o as d,_ as f,c as i,s as l,p as n,u as o,C as r,S as s,m as t,r as u};
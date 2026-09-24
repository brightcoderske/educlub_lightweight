/**
 * Text in, safe to place in an HTML text node or a double-quoted attribute.
 *
 * Used wherever a value ends up inside markup we build: the emails the platform
 * sends and the generated course pages. Single-quoted attributes are not
 * covered, so markup built from this must quote its attributes with double quotes.
 */
function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { escapeHtml };

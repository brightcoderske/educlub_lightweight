const path = require("path");

const UPLOADS_ROOT = path.resolve(__dirname, "../../uploads");

/**
 * The address stored for an uploaded file: always the path alone, /uploads/....
 * The site and the API share one address, so the browser resolves it there.
 * Storing a host (as this used to) tied every saved logo, banner and image to
 * the domain it was uploaded on, so a move of domain broke them all.
 */
function uploadUrl(relativePath) {
  return String(relativePath).replace(/\\/g, "/");
}

/**
 * The file on disk behind a stored upload address, or null when it is not one.
 * Accepts the path alone and the older full addresses (any host). Never
 * resolves outside the uploads folder, whatever the stored value says.
 */
function uploadLocalPath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  let uploadPath = fileUrl;
  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      uploadPath = new URL(fileUrl).pathname;
    } catch {
      return null;
    }
  }
  if (!uploadPath.startsWith("/uploads/")) return null;
  const local = path.resolve(UPLOADS_ROOT, `.${decodeURIComponent(uploadPath.slice("/uploads".length))}`);
  return local.startsWith(UPLOADS_ROOT + path.sep) ? local : null;
}

module.exports = { UPLOADS_ROOT, uploadUrl, uploadLocalPath };

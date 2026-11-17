const fs = require("fs");
const path = require("path");
const express = require("express");

// Requests the API owns. Everything else is the website.
const API_PATH = /^\/(?:api|uploads|health)(?:\/|$)/;

function isApiRequest(req) {
  return API_PATH.test(req.path);
}

// Runs `middleware` for API requests only, so the website keeps the headers it
// had on Vercel. The API's strict Content-Security-Policy must not reach the
// pages: it would block the page's inline start-up script, and a code preview
// iframe (srcdoc) inherits its parent's policy, so learners' own scripts and
// styles would stop running.
function forApiOnly(middleware) {
  return (req, res, next) => (isApiRequest(req) ? middleware(req, res, next) : next());
}

function siteHeaders(production) {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    if (production) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    next();
  };
}

function cacheFor(filePath) {
  // Vite names every file in assets/ by its content hash, so it never changes.
  if (filePath.includes(`${path.sep}assets${path.sep}`)) return "public, max-age=31536000, immutable";
  if (filePath.endsWith(".html")) return "no-cache";
  return "public, max-age=86400";
}

/**
 * Serves the built website (frontend/build) from the same address as the API.
 * One address means no cross-site requests, so no CORS checks at all, and a
 * host firewall's "are you human" page is shown on a page the learner can
 * answer rather than to the app's background requests, which cannot.
 *
 * The build has a page of its own for some public addresses (/login,
 * /typing...) for search engines; those are served as they are, and every
 * other address gets index.html for the app to route.
 */
function frontendSite(buildDir, { production = false } = {}) {
  const root = path.resolve(buildDir);
  const indexFile = path.join(root, "index.html");
  const router = express.Router();

  router.use(siteHeaders(production));
  router.use(
    express.static(root, {
      index: false,
      redirect: false,
      setHeaders: (res, filePath) => res.setHeader("Cache-Control", cacheFor(filePath)),
    }),
  );

  router.get(/.*/, (req, res, next) => {
    if (isApiRequest(req)) return next();
    // A missing script, image or stylesheet is a 404, not the app's page:
    // handing HTML to a script tag hides which file is gone.
    if (path.extname(req.path)) return next();

    const page = path.join(root, path.normalize(req.path), "index.html");
    const servable = page.startsWith(root + path.sep) && fs.existsSync(page) ? page : indexFile;
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(servable);
  });

  return router;
}

function hasBuild(buildDir) {
  return fs.existsSync(path.join(buildDir, "index.html"));
}

module.exports = { frontendSite, forApiOnly, hasBuild, isApiRequest };

const path = require("path");
const dotenv = require("dotenv");

/**
 * Names of variables the process already has set to something other than what
 * .env says. dotenv never overrides the process environment, so for these the
 * .env value is ignored - which is exactly how "I edited .env and nothing
 * changed" happens when a hosting panel or a shell also defines the variable.
 * Names only: values are secrets and never leave this module.
 */
function findShadowedKeys(fileValues, environment) {
  return Object.keys(fileValues).filter(
    (key) => environment[key] !== undefined && environment[key] !== fileValues[key],
  );
}

let loaded;

/**
 * Reads .env into process.env, once, and remembers what it found.
 *
 * Whichever caller gets here first does the work and every later one gets the
 * same answer. That matters because the answer cannot be recomputed afterwards:
 * once the file has been read the process environment already contains its
 * values and the disagreement is gone.
 */
function loadEnv(envPath = path.resolve(process.cwd(), ".env")) {
  if (loaded) return loaded;

  // Taken before dotenv adds to it, for the same reason.
  const inherited = { ...process.env };
  // No .env file is normal where the host injects every variable itself.
  const { parsed = {}, error } = dotenv.config({ path: envPath });

  loaded = {
    path: envPath,
    found: !error,
    shadowed: findShadowedKeys(parsed, inherited),
  };
  return loaded;
}

module.exports = { loadEnv, findShadowedKeys };

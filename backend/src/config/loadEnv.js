const path = require("path");
const dotenv = require("dotenv");

// The mail settings are the ones changed when a mailbox or a provider changes,
// and the ones stale copies keep turning up for: an old entry in the hosting
// panel, an export in a shell startup file. For these the file is authoritative,
// so editing .env is all it takes. Every other setting keeps dotenv's rule, that
// the process environment wins.
const FILE_WINS = /^EMAIL_/;

/**
 * Names of variables the process environment sets to something other than what
 * .env says. Names only: values are secrets and never leave this module.
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
 *
 * `shadowed` are settings where the environment won and the file's value was
 * ignored. `replaced` are mail settings where the file won and the
 * environment's value was ignored. Under test the environment always wins, so
 * a developer's own .env cannot change what a test runs against.
 */
function loadEnv(envPath = path.resolve(process.cwd(), ".env")) {
  if (loaded) return loaded;

  // Taken before dotenv adds to it, for the same reason.
  const inherited = { ...process.env };
  // No .env file is normal where the host injects every variable itself.
  const { parsed = {}, error } = dotenv.config({ path: envPath });

  const clashes = findShadowedKeys(parsed, inherited);
  const replaced = inherited.NODE_ENV === "test" ? [] : clashes.filter((key) => FILE_WINS.test(key));
  for (const key of replaced) process.env[key] = parsed[key];

  loaded = {
    path: envPath,
    found: !error,
    shadowed: clashes.filter((key) => !replaced.includes(key)),
    replaced,
  };
  return loaded;
}

module.exports = { loadEnv, findShadowedKeys };

/**
 * Recovering a page that was opened before a new version of the site was published.
 *
 * Each screen is a file named after a hash of what is in it, so every release
 * replaces them, and the host answers a file that no longer exists with the home
 * page. The page that was already open then asks for a screen it can no longer get,
 * nothing can draw it, and a working page turns white. Loading it again fetches the
 * current release, which is all it takes.
 */

// What Chrome, Firefox and Safari say when a script or stylesheet that a screen
// needs cannot be fetched, and the wording Vite uses for the stylesheet case.
const MISSING_FILE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

const RELOADED_AT_KEY = "educlub:reloaded-for-new-version";

// Failing again this soon after a reload is a real fault, not an old page, and
// reloading a second time would only repeat it.
const RELOAD_COOLDOWN_MS = 30 * 1000;

export function isMissingFileError(error) {
  return MISSING_FILE.test(String(error?.message ?? error ?? ""));
}

/**
 * Loads the page again, unless that was already done a moment ago. Says whether it
 * did, so a caller can tell an old page that is now reloading from a fault the
 * reload did not clear, which has to be shown to the person.
 */
export function reloadForNewVersion({
  now = Date.now(),
  storage,
  reload = () => window.location.reload(),
} = {}) {
  try {
    const store = storage ?? window.sessionStorage;
    const reloadedAt = Number(store.getItem(RELOADED_AT_KEY));
    if (reloadedAt && now - reloadedAt < RELOAD_COOLDOWN_MS) return false;
    store.setItem(RELOADED_AT_KEY, String(now));
  } catch {
    // With nowhere to remember it, a page that keeps failing would reload forever.
    return false;
  }
  reload();
  return true;
}

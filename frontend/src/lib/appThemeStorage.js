export const APP_THEME_KEY = "educlub-theme";

// Kept free of imports so the context provider can read the saved choice while
// building its initial state, without importing the palette module that in turn
// imports the context.
export function storedAppTheme() {
  try {
    return window.localStorage.getItem(APP_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    // Private windows and blocked site data throw on access. Start light.
    return "light";
  }
}

export function storeAppTheme(theme) {
  try {
    window.localStorage.setItem(APP_THEME_KEY, theme === "dark" ? "dark" : "light");
  } catch {
    // A preference we cannot persist is still applied for this session.
  }
}

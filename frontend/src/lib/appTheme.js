import { useMaterialUIController } from "context";

export { APP_THEME_KEY, storedAppTheme, storeAppTheme } from "lib/appThemeStorage";

/**
 * One named surface set for every themed dashboard - learner and teacher alike.
 *
 * This is deliberately NOT the MUI palette and NOT MD2's `darkMode` flag.
 * MDTypography and MDBox read `darkMode` globally and force their text white
 * wherever they render, so a dark choice made on one dashboard turned every
 * other page in the app unreadable. Themed surfaces opt in through these tokens
 * instead, which is why the switch is safe to offer per person.
 *
 * The art in DashboardIdentity keeps its own colours - it is illustration, not
 * chrome, and reads on both grounds.
 */
const LIGHT = {
  dark: false,
  page: "#f7f8fd",
  surface: "#ffffff",
  surfaceMuted: "#faf9fd",
  surfaceSunken: "#f5f3fc",
  border: "#e8e7f2",
  borderSoft: "#f0eef7",
  text: "#1e1748",
  textMuted: "#635783",
  accent: "#653bda",
  accentText: "#5c37c0",
  accentSoft: "#f0eaff",
  track: "#e9e6f3",
  heroBackground: "linear-gradient(115deg, #eeebff 0%, #f7f2ff 58%, #dceeff 100%)",
  heroBorder: "#e4ddff",
  heroTitle: "#1e1748",
  heroText: "#625a7d",
  heroEyebrow: "#6942c3",
  chipSurface: "#ffffff",
  navSurface: "#10132e",
  navBorder: "#393358",
  navText: "#b3b2ce",
  navActive: "#bd9cff",
  navActiveSurface: "#302458",
  focusRing: "#ad8aff",
};

const DARK = {
  dark: true,
  page: "#0b0d21",
  surface: "#151833",
  surfaceMuted: "#1b1f3d",
  surfaceSunken: "#1f2347",
  border: "#2b2f52",
  borderSoft: "#242847",
  text: "#f1efff",
  textMuted: "#a9a6c8",
  accent: "#a184ff",
  accentText: "#c0aaff",
  accentSoft: "#2a2352",
  track: "#2b2f52",
  heroBackground: "linear-gradient(115deg, #241d4e 0%, #1b1b3f 58%, #14294a 100%)",
  heroBorder: "#3b3470",
  heroTitle: "#f4f1ff",
  heroText: "#b3aed2",
  heroEyebrow: "#bda4ff",
  chipSurface: "#2a2c4f",
  navSurface: "#0e1128",
  navBorder: "#2b2f52",
  navText: "#a9a6c8",
  navActive: "#c9aeff",
  navActiveSurface: "#332863",
  focusRing: "#a184ff",
};

export function appPalette(theme) {
  return theme === "dark" || theme === true ? DARK : LIGHT;
}

export function useAppPalette() {
  const [controller] = useMaterialUIController();
  return appPalette(controller.appTheme);
}

// Kept as the old names so the learner pages that already import them keep
// working; both dashboards now share one palette.
export const learnerPalette = appPalette;
export const useLearnerPalette = useAppPalette;

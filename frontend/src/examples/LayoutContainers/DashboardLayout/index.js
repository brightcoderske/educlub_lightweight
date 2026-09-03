/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useEffect } from "react";

// react-router-dom components
import { NavLink, useLocation } from "react-router-dom";
import Icon from "@mui/material/Icon";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import LearnerFeedbackChat from "components/LearnerFeedbackChat";

// Material Dashboard 2 React context
import { useMaterialUIController, setLayout } from "context";
import { appPalette } from "lib/appTheme";

function DashboardLayout({ children }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, appTheme } = controller;
  const { pathname } = useLocation();
  const learnerView = pathname.startsWith("/learner");
  const teacherView = pathname.startsWith("/teacher");
  const schoolAdminView = pathname.startsWith("/school-admin");
  const systemAdminView = pathname.startsWith("/system-admin");
  // The themed surface set; the feedback chat below stays learner-only.
  const themedView = learnerView || teacherView || schoolAdminView || systemAdminView;
  // The five places each role actually goes, one thumb-reach away on a phone
  // where the sidenav is a drawer that has to be opened first.
  const quickNav = learnerView
    ? [
        ["Home", "/learner", "home"],
        ["Courses", "/learner/courses", "menu_book"],
        ["Challenges", "/learner/typing-quizzes", "emoji_events"],
        ["Progress", "/learner/progress", "insights"],
        ["Profile", "/learner/profile", "person"],
      ]
    : teacherView
    ? [
        ["Home", "/teacher", "home"],
        ["Courses", "/school-admin/courses", "menu_book"],
        ["Learners", "/school-admin/learners", "groups"],
        ["Progress", "/school-admin/progress", "insights"],
        ["Reports", "/school-admin/reports", "assessment"],
      ]
    : schoolAdminView
    ? [
        ["Home", "/school-admin", "home"],
        ["Learners", "/school-admin/learners", "groups"],
        ["Courses", "/school-admin/courses", "menu_book"],
        ["Progress", "/school-admin/progress", "insights"],
        ["Reports", "/school-admin/reports", "assessment"],
      ]
    : systemAdminView
    ? [
        ["Home", "/system-admin", "home"],
        ["Schools", "/system-admin/schools", "apartment"],
        ["Learners", "/system-admin/learners", "groups"],
        ["Courses", "/system-admin/courses", "menu_book"],
        ["Reports", "/system-admin/reports", "assessment"],
      ]
    : null;
  // Every themed colour below comes from here, so the theme switch is one
  // lookup rather than a rewrite of the block.
  const palette = appPalette(appTheme);
  const dark = palette.dark;

  useEffect(() => {
    setLayout(dispatch, "dashboard");
    if (learnerView) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, dispatch, learnerView]);

  // The themed ground has to reach the edges of the window, not just the
  // content box, or a short page shows the default white below it.
  useEffect(() => {
    if (!themedView) return undefined;
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = palette.page;
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, [themedView, palette.page]);

  return (
    <MDBox
      component="main"
      className={themedView ? "themed-workspace" : undefined}
      sx={({ breakpoints, transitions, functions: { pxToRem } }) => ({
        p: 1.5,
        position: "relative",

        [breakpoints.up("sm")]: {
          p: 2.5,
        },

        "& .MuiCard-root": {
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          boxShadow: "0 2px 5px rgba(15,23,42,0.03)",
        },
        "& .MuiTypography-h3": { fontSize: "1.45rem", lineHeight: 1.3 },
        ...(themedView && {
          // No minHeight here. This box sits below the navbar and inside the
          // page padding, so forcing it to a full viewport height made the page
          // taller than the screen and left an empty band under short pages.
          // The themed ground is painted on the body instead, which covers the
          // viewport without inflating the content.
          background: palette.page,
          color: palette.text,
          // Clears the mobile bottom bar, which only the learner area has.
          ...(quickNav && { paddingBottom: "92px !important" }),
          "& .MuiCard-root": {
            border: `1px solid ${palette.border}`,
            borderRadius: "14px",
            boxShadow: dark ? "none" : "0 3px 12px rgba(38,27,83,.03)",
            backgroundColor: palette.surface,
            backgroundImage: "none",
            color: palette.text,
            overflow: "hidden",
          },
          // A card inside a card is a grouping, not a second surface. Left with
          // its own border, radius and shadow every nesting level reads as one
          // more heavy box, which is what made these pages feel oversized.
          "& .MuiCard-root .MuiCard-root": {
            borderRadius: "10px",
            boxShadow: "none",
            border: `1px solid ${palette.borderSoft}`,
          },
          "& .MuiButton-root": {
            borderRadius: "11px",
            textTransform: "none",
            fontWeight: 700,
            minHeight: 40,
            letterSpacing: 0,
          },
          '& .MuiButton-contained[data-color="info"]:not(.Mui-disabled)': {
            background: "linear-gradient(110deg,#7750f8,#5730df)",
            color: "#fff",
            boxShadow: "0 4px 10px #7040e822",
          },
          '& .MuiButton-outlined[data-color="info"], & .MuiButton-text[data-color="info"]': {
            color: palette.accent,
          },
          "& .MuiTypography-body2, & .MuiTypography-caption": { fontWeight: 400 },
          "& .MuiTypography-h5": { fontSize: "1.125rem", lineHeight: 1.35 },
          "& .MuiTypography-h6": { fontSize: "1rem", lineHeight: 1.4 },
          "& .MuiLinearProgress-root": {
            borderRadius: "12px",
            height: 7,
            backgroundColor: palette.track,
          },
          "& .MuiLinearProgress-bar": { borderRadius: "12px" },
          "& .MuiChip-root": { fontWeight: 700 },
          "& .MuiTabs-root": {
            background: palette.surfaceSunken,
            padding: "5px",
            borderRadius: "13px",
          },
          "& .MuiTab-root": { textTransform: "none", minHeight: 42, fontWeight: 700, zIndex: 1 },
          "& .MuiTab-root.Mui-selected": { color: palette.accentText },
          "& .MuiOutlinedInput-root": {
            borderRadius: "12px",
            backgroundColor: palette.surface,
            color: palette.text,
          },
          "& .MuiInputLabel-root, & .MuiInputBase-input": { color: palette.text },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: palette.border },
          "& .MuiTableCell-head": {
            backgroundColor: palette.surfaceSunken,
            color: palette.textMuted,
            fontWeight: 700,
          },
          "& .MuiTableCell-body": { borderColor: palette.borderSoft, color: palette.text },
          // The learner pages set their own body copy colour through the theme
          // text token, which is tuned for the light ground. On dark it has to
          // follow the surface or the copy sits invisible on the card.
          // Set for BOTH themes, not just dark. MDTypography resolves its own
          // colour from the MUI palette, which only knows the light ground, so
          // without this the copy stays dark-on-dark the moment the surface
          // flips.
          "& .MuiTypography-root": { color: palette.text },
          "& .MuiTypography-caption, & .MuiTypography-body2": { color: palette.textMuted },
          "& button:focus-visible, & a:focus-visible, & input:focus-visible": {
            outline: `3px solid ${palette.focusRing}`,
            outlineOffset: 3,
          },
          "@media (prefers-reduced-motion: reduce)": {
            "& *, & *::before, & *::after": {
              animation: "none !important",
              transition: "none !important",
              scrollBehavior: "auto !important",
            },
          },
        }),
        [breakpoints.up("lg")]: {
          marginLeft: miniSidenav ? pxToRem(76) : pxToRem(248),
          transition: transitions.create(["margin-left", "margin-right"], {
            easing: transitions.easing.easeInOut,
            duration: transitions.duration.standard,
          }),
          // The padding above only clears the bottom bar, which is mobile-only.
          // Left in place here it reads as an empty strip under every page.
          ...(quickNav && { paddingBottom: "24px !important" }),
        },
      })}
    >
      {children}
      {learnerView && <LearnerFeedbackChat />}
      {quickNav && (
        <MDBox
          component="nav"
          aria-label="Quick navigation"
          sx={{
            display: { xs: "grid", lg: "none" },
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            bgcolor: palette.navSurface,
            borderTop: `1px solid ${palette.navBorder}`,
            pt: 1,
            pb: "max(10px, env(safe-area-inset-bottom))",
            boxShadow: "0 -5px 25px #16123415",
          }}
        >
          {quickNav.map(([label, to, icon]) => (
            <MDBox
              key={to}
              component={NavLink}
              to={to}
              end={["/learner", "/teacher", "/school-admin", "/system-admin"].includes(to)}
              sx={{
                minHeight: 46,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 0.4,
                color: palette.navText,
                fontSize: ".62rem",
                fontWeight: 600,
                textDecoration: "none",
                "&.active": {
                  color: palette.navActive,
                  "& .material-icons-round": {
                    bgcolor: palette.navActiveSurface,
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <Icon sx={{ px: 1.2, width: 43, height: 27, fontSize: "22px !important" }}>
                {icon}
              </Icon>
              {label}
            </MDBox>
          ))}
        </MDBox>
      )}
    </MDBox>
  );
}

// Typechecking props for the DashboardLayout
DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default DashboardLayout;

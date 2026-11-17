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
function navbar(theme, { absolute }) {
  const gap = absolute ? 0 : 12;
  // The bar sticks a little below the top of the screen. That gap is covered
  // in the page colour, or text scrolling up shows through above the bar.
  const coverGap = (height) => ({
    content: '""',
    position: "absolute",
    left: -16,
    right: -16,
    top: -height,
    height,
    backgroundColor: theme.palette.background.default,
  });
  return {
    top: gap,
    display: "block",
    padding: 0,
    color: "#334155",
    backdropFilter: "none",
    "&::before": gap ? coverGap(gap) : {},
    [theme.breakpoints.down("sm")]: {
      top: gap ? 6 : 0,
      "&::before": gap ? coverGap(6) : {},
    },
  };
}

const navbarContainer = (theme, { hasActions }) => ({
  display: "grid !important",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gridTemplateAreas: hasActions ? '"title account" "actions actions"' : '"title account"',
  alignItems: "center",
  columnGap: 1.25,
  rowGap: 1,
  minHeight: "60px !important",
  p: "10px 12px !important",
  // A page's buttons share the title's row only on the widest screens. Below
  // that they take a row of their own: squeezed in beside the title, a page
  // with several (the course builder) cut its title to "School ..." and
  // still spilled its buttons onto two lines.
  [theme.breakpoints.up("xxl")]: {
    gridTemplateColumns: hasActions ? "minmax(220px, 1fr) auto auto" : "minmax(0, 1fr) auto",
    gridTemplateAreas: hasActions ? '"title actions account"' : '"title account"',
  },
});

const navbarRow = () => ({
  gridArea: "account",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  minWidth: 0,
});

const navbarIconButton = () => ({
  width: 34,
  height: 34,
  p: 0.75,
  color: "#64748b",
  "& .material-icons, .material-icons-round": { fontSize: "20px !important" },
});

export { navbar, navbarContainer, navbarRow, navbarIconButton };

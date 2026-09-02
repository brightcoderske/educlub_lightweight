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
  return {
    top: absolute ? 0 : 12,
    display: "block",
    padding: 0,
    color: "#334155",
    backdropFilter: "none",
    [theme.breakpoints.down("sm")]: { top: 6 },
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
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: hasActions ? "minmax(180px, 1fr) auto auto" : "minmax(0, 1fr) auto",
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

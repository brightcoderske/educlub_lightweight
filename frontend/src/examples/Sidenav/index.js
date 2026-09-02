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
import { NavLink, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import Drawer from "@mui/material/Drawer";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController, setMiniSidenav } from "context";
import { useAuth } from "context/AuthContext";

function Sidenav({ brand, brandName, routes }) {
  const { logout } = useAuth();
  const [controller, dispatch] = useMaterialUIController();
  const desktop = useMediaQuery((theme) => theme.breakpoints.up("lg"));
  const { pathname } = useLocation();
  const collapsed = desktop && controller.miniSidenav;
  const close = () => setMiniSidenav(dispatch, true);
  const activeRoute = routes
    .filter(({ route }) => route && (pathname === route || pathname.startsWith(route + "/")))
    .sort((a, b) => b.route.length - a.route.length)[0]?.route;

  useEffect(() => {
    setMiniSidenav(dispatch, !desktop);
  }, [desktop, dispatch]);

  useEffect(() => {
    if (!desktop) setMiniSidenav(dispatch, true);
  }, [pathname, desktop, dispatch]);

  return (
    <Drawer
      variant={desktop ? "permanent" : "temporary"}
      open={desktop || !controller.miniSidenav}
      onClose={close}
      ModalProps={{ keepMounted: true }}
      PaperProps={{ component: "nav", id: "dashboard-navigation", "aria-label": "Main navigation" }}
      sx={{
        width: 0,
        "& .MuiDrawer-paper": {
          width: collapsed ? 76 : 248,
          maxWidth: "85vw",
          height: "100dvh",
          m: 0,
          borderRadius: 0,
          background: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          boxShadow: desktop ? "none" : "8px 0 30px rgba(15,23,42,0.12)",
          overflowX: "hidden",
          transition: "width 180ms ease",
        },
      }}
    >
      <MDBox
        display="flex"
        alignItems="center"
        gap={1}
        px={2}
        height={72}
        flexShrink={0}
        borderBottom="1px solid #edf1f5"
      >
        <MDBox
          component={NavLink}
          to="/"
          display="flex"
          alignItems="center"
          gap={1.25}
          minWidth={0}
          sx={{ textDecoration: "none" }}
        >
          {brand && (
            <MDBox
              component="img"
              src={brand}
              alt=""
              width={32}
              height={32}
              sx={{ objectFit: "contain" }}
            />
          )}
          {!collapsed && (
            <MDTypography
              variant="button"
              fontWeight="bold"
              sx={{
                color: "#172b46",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {brandName}
            </MDTypography>
          )}
        </MDBox>
        {!desktop && (
          <IconButton
            aria-label="Close navigation"
            onClick={close}
            sx={{ ml: "auto", color: "#475569" }}
          >
            <Icon>close</Icon>
          </IconButton>
        )}
      </MDBox>
      <List sx={{ p: 1.25, overflowY: "auto", flex: 1 }}>
        {routes
          .filter((route) => route.type === "collapse")
          .map(({ key, name, icon, route, href }) => (
            <ListItem key={key} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={collapsed ? name : ""} placement="right">
                <ListItemButton
                  component={href ? "a" : NavLink}
                  {...(href
                    ? { href, target: "_blank", rel: "noreferrer" }
                    : { to: route, end: route === activeRoute })}
                  selected={route === activeRoute}
                  aria-label={name}
                  onClick={() => {
                    if (!desktop) close();
                  }}
                  sx={{
                    minHeight: 42,
                    px: collapsed ? 1.25 : 1.5,
                    borderRadius: "8px",
                    color: "#475569",
                    "&.Mui-selected": { bgcolor: "#eaf2ff", color: "#175cd3" },
                    "&:hover": { bgcolor: "#f1f5f9" },
                    "&.Mui-selected:hover": { bgcolor: "#deebff" },
                    "&:focus-visible": { outline: "2px solid #2563eb", outlineOffset: 1 },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 28 : 34,
                      color: "inherit",
                      "& .material-icons-round": { fontSize: "20px !important" },
                    }}
                  >
                    {icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={name}
                      primaryTypographyProps={{
                        fontSize: "0.82rem",
                        fontWeight: route === activeRoute ? 600 : 400,
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
      </List>
      <MDBox p={1.25} borderTop="1px solid #edf1f5" flexShrink={0}>
        <Tooltip title={collapsed ? "Log out" : ""} placement="right">
          <ListItemButton
            component="button"
            aria-label="Log out"
            onClick={logout}
            sx={{
              width: "100%",
              minHeight: 44,
              px: 1.5,
              borderRadius: "8px",
              color: "#475569",
              "&:hover": { bgcolor: "#f1f5f9" },
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 28 : 34, color: "inherit" }}>
              <Icon sx={{ fontSize: "20px !important" }}>logout</Icon>
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="Log out"
                primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 600 }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </MDBox>
    </Drawer>
  );
}

Sidenav.defaultProps = { brand: "" };
Sidenav.propTypes = {
  brand: PropTypes.string,
  brandName: PropTypes.string.isRequired,
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};
export default Sidenav;

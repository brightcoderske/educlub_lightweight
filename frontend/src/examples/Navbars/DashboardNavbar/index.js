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

import { useState, useEffect } from "react";

// react-router components
import { useLocation } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @material-ui core components
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDAvatar from "components/MDAvatar";

// Material Dashboard 2 React example components
import Breadcrumbs from "examples/Breadcrumbs";

// Custom styles for DashboardNavbar
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

// Material Dashboard 2 React context
import { useMaterialUIController, setTransparentNavbar, setMiniSidenav } from "context";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getRoleLabel, getUserDisplayName, getUserInitials } from "lib/userDisplay";

function DashboardNavbar({ absolute, light, isMini, autoHideOnScroll }) {
  const [navbarType, setNavbarType] = useState();
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, darkMode } = controller;
  const { user, logout } = useAuth();
  const route = useLocation().pathname.split("/").slice(1);
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  useEffect(() => {
    // Setting the navbar type
    if (fixedNavbar) {
      setNavbarType("sticky");
    } else {
      setNavbarType("static");
    }

    // A function that sets the transparent state of the navbar.
    function handleTransparentNavbar() {
      setTransparentNavbar(dispatch, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    }

    /** 
     The event listener that's calling the handleTransparentNavbar function when 
     scrolling the window.
    */
    window.addEventListener("scroll", handleTransparentNavbar);

    // Call the handleTransparentNavbar function to set the state with the initial value.
    handleTransparentNavbar();

    // Remove event listener on cleanup
    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  useEffect(() => {
    if (!autoHideOnScroll) {
      setHiddenOnScroll(false);
      return undefined;
    }

    function handleHiddenNavbar() {
      setHiddenOnScroll(window.scrollY > 48);
    }

    window.addEventListener("scroll", handleHiddenNavbar, { passive: true });
    handleHiddenNavbar();
    return () => window.removeEventListener("scroll", handleHiddenNavbar);
  }, [autoHideOnScroll]);

  const handleMiniSidenav = () => setMiniSidenav(dispatch, !miniSidenav);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      if (!user) return;
      try {
        const response = await apiClient.get("/notifications?limit=10");
        if (active) setNotifications(response);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      }
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    async function loadFeedbackUnread() {
      if (user?.role !== "learner") {
        if (active) setFeedbackUnread(0);
        return;
      }

      try {
        const response = await apiClient.get("/feedback/learner/unread");
        if (active) setFeedbackUnread(response.unread_replies || 0);
      } catch (error) {
        if (active) setFeedbackUnread(0);
      }
    }

    loadFeedbackUnread();
    window.addEventListener("educlub:feedback-unread-changed", loadFeedbackUnread);
    const interval = setInterval(loadFeedbackUnread, 2 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("educlub:feedback-unread-changed", loadFeedbackUnread);
    };
  }, [user?.id, user?.role]);

  const openNotifications = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const openFeedbackChat = () => {
    window.dispatchEvent(new CustomEvent("educlub:open-feedback-chat"));
  };

  const markNotificationRead = async (notification) => {
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    try {
      await apiClient.put(`/notifications/${notification.id}/read`, {});
    } catch (error) {
      setNotifications((current) =>
        current.some((item) => item.id === notification.id)
          ? current
          : [notification, ...current].slice(0, 10)
      );
      console.error("Failed to update notification:", error);
    }
  };

  // Styles for the navbar icons
  const iconsStyle = ({ palette: { dark, white, text }, functions: { rgba } }) => ({
    color: () => {
      let colorValue = light || darkMode ? white.main : dark.main;

      if (transparentNavbar && !light) {
        colorValue = darkMode ? rgba(text.main, 0.6) : text.main;
      }

      return colorValue;
    },
  });

  return (
    <AppBar
      position={absolute ? "absolute" : navbarType}
      color="inherit"
      sx={(theme) => ({
        ...navbar(theme, { transparentNavbar, absolute, light, darkMode }),
        ...(autoHideOnScroll && {
          transition: theme.transitions.create(["transform", "opacity"], {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.shorter,
          }),
          transform: hiddenOnScroll ? "translateY(-120%)" : "translateY(0)",
          opacity: hiddenOnScroll ? 0 : 1,
          pointerEvents: hiddenOnScroll ? "none" : "auto",
        }),
      })}
    >
      <Toolbar sx={(theme) => navbarContainer(theme)}>
        <MDBox color="inherit" mb={{ xs: 1, md: 0 }} sx={(theme) => navbarRow(theme, { isMini })}>
          <Breadcrumbs icon="home" title={route[route.length - 1]} route={route} light={light} />
        </MDBox>
        {isMini ? null : (
          <MDBox sx={(theme) => navbarRow(theme, { isMini })}>
            <MDBox
              display="flex"
              alignItems="center"
              gap={{ xs: 0.75, sm: 1.25 }}
              mr={{ xs: 0.5, sm: 1.5 }}
              minWidth={0}
            >
              <MDAvatar
                src={user?.schoolLogoUrl || undefined}
                alt={user?.schoolName || getUserDisplayName(user)}
                bgColor="info"
                size="sm"
                shadow="sm"
              >
                {getUserInitials(user)}
              </MDAvatar>
              <MDBox lineHeight={1} minWidth={0}>
                <MDTypography
                  variant="button"
                  fontWeight="medium"
                  color={light ? "white" : "text"}
                  sx={{
                    display: "block",
                    maxWidth: { xs: 115, sm: "none" },
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getUserDisplayName(user)}
                </MDTypography>
                <MDTypography
                  variant="caption"
                  color={light ? "white" : "text"}
                  display={{ xs: "none", sm: "block" }}
                >
                  {[user?.schoolName, getRoleLabel(user?.role)].filter(Boolean).join(" · ")}
                </MDTypography>
              </MDBox>
            </MDBox>
            <MDBox
              color={light ? "white" : "inherit"}
              display="flex"
              alignItems="center"
              flexShrink={0}
            >
              {user?.role === "learner" && (
                <IconButton
                  size="small"
                  disableRipple
                  color="inherit"
                  sx={navbarIconButton}
                  onClick={openFeedbackChat}
                >
                  <Badge badgeContent={feedbackUnread} color="error">
                    <Icon sx={iconsStyle}>chat</Icon>
                  </Badge>
                </IconButton>
              )}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                onClick={openNotifications}
              >
                <Badge badgeContent={unreadCount} color="error">
                  <Icon sx={iconsStyle}>notifications</Icon>
                </Badge>
              </IconButton>
              <Menu
                anchorEl={notificationAnchor}
                open={Boolean(notificationAnchor)}
                onClose={() => setNotificationAnchor(null)}
                PaperProps={{ sx: { width: 340, maxWidth: "90vw" } }}
              >
                {notifications.length === 0 ? (
                  <MenuItem>
                    <MDTypography variant="caption" color="text">
                      No notifications yet
                    </MDTypography>
                  </MenuItem>
                ) : (
                  notifications.map((notification) => (
                    <MenuItem
                      key={notification.id}
                      onClick={() => markNotificationRead(notification)}
                      sx={{ whiteSpace: "normal", alignItems: "flex-start" }}
                    >
                      <MDBox>
                        <MDTypography
                          variant="button"
                          fontWeight={notification.is_read ? "regular" : "bold"}
                        >
                          {notification.title}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          {notification.message}
                        </MDTypography>
                      </MDBox>
                    </MenuItem>
                  ))
                )}
              </Menu>
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarMobileMenu}
                onClick={handleMiniSidenav}
              >
                <Icon sx={iconsStyle} fontSize="medium">
                  {miniSidenav ? "menu_open" : "menu"}
                </Icon>
              </IconButton>
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                onClick={logout}
              >
                <Icon sx={iconsStyle}>logout</Icon>
              </IconButton>
            </MDBox>
          </MDBox>
        )}
      </Toolbar>
    </AppBar>
  );
}

// Setting default values for the props of DashboardNavbar
DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
  autoHideOnScroll: false,
};

// Typechecking props for the DashboardNavbar
DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
  autoHideOnScroll: PropTypes.bool,
};

export default DashboardNavbar;

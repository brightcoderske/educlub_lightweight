/**
=========================================================
* eduClub LMS - Main Application
=========================================================

* Copyright 2026 eduClub
*/

import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, matchPath } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import MaterialDashboard from "assets/theme";
import eduClubLogo from "assets/images/brand/educlub-logo.png";
import Sidenav from "examples/Sidenav";
import IdleTimeoutGuard from "components/IdleTimeoutGuard";

// eduClub routes
import routes from "routes";

// eduClub contexts
import { AuthProvider, useAuth } from "context/AuthContext";

function AppContent() {
  const { user, loading, logout } = useAuth();
  const { pathname } = useLocation();

  const matchedRoute =
    routes.find(
      (route) =>
        route.route !== "*" && matchPath({ path: route.route, end: true }, pathname)
    ) || routes.find((route) => route.route === "*");
  const publicRoute = Boolean(matchedRoute?.public);
  const authRoute = publicRoute || pathname.startsWith("/authentication/") || pathname === "/privacy-consent";
  const focusedLearningRoute = /^\/learner\/courses\/[^/]+\/modules\/[^/]+\/learn$/.test(pathname);
  const showSidenav = Boolean(user) && !authRoute && !focusedLearningRoute;
  const sidenavRoutes = routes.filter(
    (route) => !route.hidden && (!route.roles || route.roles.includes(user?.role))
  );

  useEffect(() => {
    if (publicRoute) return;
    let robots = document.querySelector("meta[name='robots']");
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
  }, [pathname, publicRoute]);

  const dashboardForRole = (role) => {
    if (role === "system_admin") return "/system-admin";
    if (role === "school_admin") return "/school-admin";
    if (role === "teacher") return "/teacher";
    if (role === "learner") return "/learner";
    return "/authentication/sign-in";
  };

  const onboardingPathForUser = () => {
    if (user?.forcePasswordReset) return "/authentication/reset-password";
    if (user?.consentRequired) return "/privacy-consent";
    return null;
  };

  const guardedElement = (route, component, roles, isPublic) => {
    if (!user && !isPublic) {
      return <Navigate to="/authentication/sign-in" replace />;
    }

    const onboardingPath = onboardingPathForUser();
    if (onboardingPath && route !== onboardingPath) {
      return <Navigate to={onboardingPath} replace />;
    }

    if (user && ["/login", "/authentication/sign-in"].includes(route)) {
      if (onboardingPath) {
        return <Navigate to={onboardingPath} replace />;
      }
      return <Navigate to={dashboardForRole(user.role)} replace />;
    }

    if (user && roles && !roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }

    return component;
  };

  const getRoutes = () =>
    routes.map(({ key, route, component, roles, public: isPublic }) => (
      <Route
        key={key}
        path={route}
        element={guardedElement(route, component, roles, isPublic)}
      />
    ));

  if (loading) {
    return null;
  }

  return (
    <>
      {showSidenav && (
        <Sidenav
          color="info"
          brand={user?.schoolLogoUrl || eduClubLogo}
          brandName={user?.schoolName || "eduClub LMS"}
          routes={sidenavRoutes}
        />
      )}
      <IdleTimeoutGuard active={Boolean(user)} onTimeout={logout} />
      <Routes>
        {getRoutes()}
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={MaterialDashboard}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

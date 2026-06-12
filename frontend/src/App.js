/**
=========================================================
* eduClub LMS - Main Application
=========================================================

* Copyright 2026 eduClub
*/

import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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

  const authRoutes = [
    "/authentication/sign-in",
    "/authentication/reset-password",
    "/authentication/forgot-password",
    "/authentication/set-password",
    "/privacy-consent",
    "/",
    "/register",
    "/why-choose-us",
    "/why-chose-us",
    "/why_chose_us",
    "/talk-to-us",
    "/contact",
    "/partners",
    "/digital-skills",
    "/competitions",
  ];
  const publicRoutes = [
    "/",
    "/register",
    "/why-choose-us",
    "/why-chose-us",
    "/why_chose_us",
    "/talk-to-us",
    "/contact",
    "/partners",
    "/digital-skills",
    "/competitions",
    "/authentication/sign-in",
    "/authentication/forgot-password",
    "/authentication/set-password",
  ];
  const focusedLearningRoute = /^\/learner\/courses\/[^/]+\/modules\/[^/]+\/learn$/.test(pathname);
  const showSidenav = Boolean(user) && !authRoutes.includes(pathname) && !focusedLearningRoute;
  const sidenavRoutes = routes.filter(
    (route) => !route.hidden && (!route.roles || route.roles.includes(user?.role))
  );

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

  const guardedElement = (route, component, roles) => {
    if (!user && !publicRoutes.includes(route)) {
      return <Navigate to="/authentication/sign-in" replace />;
    }

    const onboardingPath = onboardingPathForUser();
    if (onboardingPath && route !== onboardingPath) {
      return <Navigate to={onboardingPath} replace />;
    }

    if (
      user &&
      [
        "/",
        "/register",
        "/why-choose-us",
        "/why-chose-us",
        "/why_chose_us",
        "/talk-to-us",
        "/contact",
        "/partners",
        "/digital-skills",
        "/competitions",
      ].includes(route)
    ) {
      return <Navigate to={dashboardForRole(user.role)} replace />;
    }

    if (user && route === "/authentication/sign-in") {
      if (onboardingPath) {
        return <Navigate to={onboardingPath} replace />;
      }
    }

    if (user && roles && !roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }

    return component;
  };

  const getRoutes = () =>
    routes.map(({ key, route, component, roles }) => (
      <Route key={key} path={route} element={guardedElement(route, component, roles)} />
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
        <Route path="*" element={<Navigate to="/" />} />
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

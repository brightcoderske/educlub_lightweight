import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import API_BASE_URL from "lib/apiBase";
import { parseApiResponse } from "lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const getOnboardingPath = (nextUser) => {
    if (nextUser?.forcePasswordReset) {
      return "/authentication/reset-password";
    }
    if (nextUser?.consentRequired) {
      return "/privacy-consent";
    }
    return null;
  };

  const continueAfterAuth = (nextUser) => {
    const onboardingPath = getOnboardingPath(nextUser);
    if (onboardingPath) {
      navigate(onboardingPath, { replace: true });
      return {
        success: true,
        forcePasswordReset: Boolean(nextUser.forcePasswordReset),
        consentRequired: Boolean(!nextUser.forcePasswordReset && nextUser.consentRequired),
      };
    }

    redirectBasedOnRole(nextUser.role);
    return { success: true };
  };

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      let parsedUser = null;
      try {
        parsedUser = JSON.parse(userData);
      } catch (error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setLoading(false);
        return;
      }

      setUser(parsedUser);
      const onboardingPath = getOnboardingPath(parsedUser);
      if (onboardingPath) {
        navigate(onboardingPath, { replace: true });
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const trustedDeviceExpiresAt = localStorage.getItem("trustedDeviceExpiresAt");
      const trustedDeviceExpired =
        trustedDeviceExpiresAt && new Date(trustedDeviceExpiresAt) <= new Date();

      if (trustedDeviceExpired) {
        localStorage.removeItem("trustedDeviceToken");
        localStorage.removeItem("trustedDeviceExpiresAt");
      }

      const trustedDeviceToken = trustedDeviceExpired
        ? null
        : localStorage.getItem("trustedDeviceToken");

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, trustedDeviceToken }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.mfaRequired) {
        // Return temp token for MFA verification
        return { mfaRequired: true, tempToken: data.tempToken };
      }

      // Store token and user data
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);

      return continueAfterAuth(data.user);
    } catch (error) {
      throw error;
    }
  };

  const verify2FA = async (tempToken, code, rememberDevice = false) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code, rememberDevice }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "2FA verification failed");
      }

      // Store token and user data
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.trustedDeviceToken) {
        localStorage.setItem("trustedDeviceToken", data.trustedDeviceToken);
        localStorage.setItem("trustedDeviceExpiresAt", data.trustedDeviceExpiresAt);
      }
      setUser(data.user);

      return continueAfterAuth(data.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      navigate("/authentication/sign-in");
    }
  };

  const resetPassword = async (oldPassword, newPassword) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Password reset failed");
      }

      // Update user data to clear forcePasswordReset flag
      const updatedUser = { ...user, forcePasswordReset: false };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      return continueAfterAuth(updatedUser);
    } catch (error) {
      throw error;
    }
  };

  const redirectBasedOnRole = (role) => {
    switch (role) {
      case "system_admin":
        navigate("/system-admin");
        break;
      case "school_admin":
        navigate("/school-admin");
        break;
      case "teacher":
        navigate("/teacher");
        break;
      case "learner":
        navigate("/learner");
        break;
      default:
        navigate("/authentication/sign-in");
    }
  };

  const markConsentAccepted = () => {
    const updatedUser = { ...user, consentRequired: false };
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    redirectBasedOnRole(updatedUser.role);
  };

  const hasPermission = (permission) => {
    if (!user) return false;

    // Define roles and permissions locally since shared is outside src/
    const ROLES = {
      SYSTEM_ADMIN: "system_admin",
      SCHOOL_ADMIN: "school_admin",
      LEARNER: "learner",
    };

    const ROLE_PERMISSIONS = {
      [ROLES.SYSTEM_ADMIN]: [
        "manage_schools",
        "manage_users",
        "view_all_reports",
        "manage_system_settings",
      ],
      [ROLES.SCHOOL_ADMIN]: [
        "manage_learners",
        "manage_courses",
        "view_school_reports",
        "manage_allocations",
      ],
      teacher: ["manage_learners", "view_school_reports", "manage_allocations"],
      [ROLES.LEARNER]: ["view_courses", "view_progress", "view_certificates"],
    };

    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes(permission);
  };

  const isSystemAdmin = () => user?.role === "system_admin";
  const isSchoolAdmin = () => user?.role === "school_admin" || user?.role === "teacher";
  const isTeacher = () => user?.role === "teacher";
  const isLearner = () => user?.role === "learner";

  const value = {
    user,
    loading,
    login,
    verify2FA,
    logout,
    resetPassword,
    markConsentAccepted,
    hasPermission,
    isSystemAdmin,
    isSchoolAdmin,
    isTeacher,
    isLearner,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthContext;

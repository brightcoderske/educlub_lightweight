import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import CoverLayout from "examples/LayoutContainers/CoverLayout";
import bgImage from "assets/images/bg-reset-cover.jpeg";
import API_BASE_URL from "lib/apiBase";
import { parseApiResponse } from "lib/api";

function SetPassword() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const checks = useMemo(
    () => [
      ["At least 8 characters", newPassword.length >= 8],
      ["One uppercase letter", /[A-Z]/.test(newPassword)],
      ["One lowercase letter", /[a-z]/.test(newPassword)],
      ["One number", /[0-9]/.test(newPassword)],
      ["One symbol", /[^A-Za-z0-9]/.test(newPassword)],
      ["No spaces", !/\s/.test(newPassword) && newPassword.length > 0],
      ["Passwords match", newPassword.length > 0 && newPassword === confirmPassword],
    ],
    [newPassword, confirmPassword]
  );
  const passwordReady = checks.every(([, passed]) => passed);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not update password");
      }

      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CoverLayout image={bgImage}>
      <Card>
        <MDBox
          variant="gradient"
          bgColor="info"
          borderRadius="lg"
          coloredShadow="info"
          mx={2}
          mt={-3}
          p={2}
          mb={1}
          textAlign="center"
        >
          <MDTypography variant="h3" fontWeight="medium" color="white">
            Create New Password
          </MDTypography>
        </MDBox>
        <MDBox pt={4} pb={3} px={3}>
          {!token && (
            <MDTypography variant="caption" color="error" display="block" mb={2}>
              Password reset token is missing.
            </MDTypography>
          )}
          <MDBox mb={2}>
            <MDInput
              type="password"
              label="New Password"
              fullWidth
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </MDBox>
          <MDBox mb={2}>
            <MDInput
              type="password"
              label="Confirm New Password"
              fullWidth
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </MDBox>
          <MDBox mb={2}>
            {checks.map(([label, passed]) => (
              <MDTypography
                key={label}
                variant="caption"
                color={passed ? "success" : "text"}
                display="block"
              >
                {passed ? "Pass" : "Need"}: {label}
              </MDTypography>
            ))}
          </MDBox>
          {message && (
            <MDTypography variant="caption" color="success" display="block" mb={2}>
              {message}
            </MDTypography>
          )}
          {error && (
            <MDTypography variant="caption" color="error" display="block" mb={2}>
              {error}
            </MDTypography>
          )}
          <MDBox mt={4} mb={1}>
            <MDButton
              variant="gradient"
              color="info"
              fullWidth
              onClick={handleSubmit}
              disabled={loading || !token || !passwordReady}
            >
              {loading ? "Saving..." : "Save Password"}
            </MDButton>
          </MDBox>
          <MDBox mt={3} textAlign="center">
            <MDTypography
              variant="button"
              color="info"
              onClick={() => navigate("/authentication/sign-in")}
            >
              Back to Sign In
            </MDTypography>
          </MDBox>
        </MDBox>
      </Card>
    </CoverLayout>
  );
}

export default SetPassword;

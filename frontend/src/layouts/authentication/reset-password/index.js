import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import CoverLayout from "examples/LayoutContainers/CoverLayout";
import bgImage from "assets/images/bg-sign-in-basic.jpeg";
import { useAuth } from "context/AuthContext";

function ResetPassword() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { resetPassword, user } = useAuth();
  const navigate = useNavigate();

  const checks = [
    ["At least 8 characters", newPassword.length >= 8],
    ["One uppercase letter", /[A-Z]/.test(newPassword)],
    ["One lowercase letter", /[a-z]/.test(newPassword)],
    ["One number", /[0-9]/.test(newPassword)],
    ["One symbol", /[^A-Za-z0-9]/.test(newPassword)],
    ["No spaces", !/\s/.test(newPassword) && newPassword.length > 0],
    ["Passwords match", newPassword.length > 0 && newPassword === confirmPassword],
  ];
  const passwordReady = checks.every(([, passed]) => passed);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!passwordReady) {
      setError("Please complete all password requirements.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(oldPassword, newPassword);
      // Redirect happens in the resetPassword function
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
            Reset Password
          </MDTypography>
        </MDBox>
        <MDBox pt={4} pb={3} px={3}>
          <MDTypography variant="body2" color="text" mb={2}>
            You must change your password on first login.
          </MDTypography>
          <MDTypography variant="body2" color="text" mb={2}>
            Email: {user?.email}
          </MDTypography>
          <MDBox mb={2}>
            <MDInput
              type="password"
              label="Old Password"
              fullWidth
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </MDBox>
          <MDBox mb={2}>
            <MDInput
              type="password"
              label="New Password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </MDBox>
          <MDBox mb={2}>
            <MDInput
              type="password"
              label="Confirm New Password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
          {error && (
            <MDTypography variant="caption" color="error" mb={2}>
              {error}
            </MDTypography>
          )}
          <MDBox mt={4} mb={1}>
            <MDButton
              variant="gradient"
              color="info"
              fullWidth
              onClick={handleResetPassword}
              disabled={loading || !passwordReady}
            >
              {loading ? "Resetting..." : "Reset Password"}
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

export default ResetPassword;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import CoverLayout from "examples/LayoutContainers/CoverLayout";
import bgImage from "assets/images/bg-reset-cover.jpeg";
import API_BASE_URL from "lib/apiBase";
import { parseApiResponse } from "lib/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not request password reset");
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
            Reset Password
          </MDTypography>
          <MDTypography variant="button" color="white">
            We will email a secure one-time link if the account can receive email. If you cannot
            access that email, contact your System Admin or School Admin for help.
          </MDTypography>
        </MDBox>
        <MDBox pt={4} pb={3} px={3}>
          <MDBox mb={2}>
            <MDInput
              type="email"
              label="Email or username"
              fullWidth
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
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
              disabled={loading || !email}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </MDButton>
          </MDBox>
          <MDBox mt={3} textAlign="center">
            <MDTypography
              variant="button"
              color="info"
              sx={{ cursor: "pointer" }}
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

export default ForgotPassword;

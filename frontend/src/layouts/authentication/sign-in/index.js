import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import PasswordField from "components/PasswordField";
import MDButton from "components/MDButton";
import Checkbox from "@mui/material/Checkbox";
import CoverLayout from "examples/LayoutContainers/CoverLayout";
import bgImage from "assets/images/bg-sign-in-basic.jpeg";
import eduClubLogo from "assets/images/brand/educlub-logo.png";
import { useAuth } from "context/AuthContext";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await login(email, password);

      if (result.mfaRequired) {
        setMfaRequired(true);
        setTempToken(result.tempToken);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await verify2FA(tempToken, mfaCode, rememberDevice);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mfaRequired) {
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
            <MDBox
              component="img"
              src={eduClubLogo}
              alt="eduClub LMS"
              width="76px"
              height="76px"
              borderRadius="50%"
              bgColor="white"
              p={1}
              mb={1}
            />
            <MDTypography variant="h3" fontWeight="medium" color="white">
              Two-Factor Authentication
            </MDTypography>
          </MDBox>
          <MDBox pt={4} pb={3} px={3}>
            <MDTypography variant="body2" color="text" mb={2}>
              Enter the 6-digit code sent to your email:
            </MDTypography>
            <MDBox mb={2}>
              <MDInput
                type="text"
                label="MFA Code"
                fullWidth
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                error={!!error}
              />
            </MDBox>
            <MDBox display="flex" alignItems="center" mb={1}>
              <Checkbox
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              <MDTypography variant="button" color="text">
                Remember this device for 12 hours
              </MDTypography>
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
                onClick={handle2FA}
                disabled={loading || mfaCode.length !== 6}
              >
                {loading ? "Verifying..." : "Verify"}
              </MDButton>
            </MDBox>
            <MDBox mt={3} textAlign="center">
              <MDTypography variant="button" color="info" onClick={() => setMfaRequired(false)}>
                Back to Login
              </MDTypography>
            </MDBox>
          </MDBox>
        </Card>
      </CoverLayout>
    );
  }

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
          <MDBox
            component="img"
            src={eduClubLogo}
            alt="eduClub LMS"
            width="76px"
            height="76px"
            borderRadius="50%"
            bgColor="white"
            p={1}
            mb={1}
          />
          <MDTypography variant="h3" fontWeight="medium" color="white">
            eduClub LMS
          </MDTypography>
          <MDTypography variant="button" color="white">
            Sign in to continue
          </MDTypography>
        </MDBox>
        <MDBox pt={4} pb={3} px={3}>
          <MDBox
            mb={3}
            p={2}
            borderRadius="md"
            sx={({ palette }) => ({
              backgroundColor: palette.grey[100],
              border: `1px solid ${palette.grey[300]}`,
            })}
          >
            <MDTypography variant="caption" color="text" fontWeight="medium" display="block" mb={1}>
              Privacy notice
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block">
              eduClub collects account, school, learner profile, course allocation, progress, marks,
              reports, certificates, course access, security, and audit data to run the learning
              platform and protect users. After sign-in, you will be asked to accept the full user
              agreement before accessing your dashboard.
            </MDTypography>
          </MDBox>
          <MDBox mb={2}>
            <MDInput
              type="email"
              label="Email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </MDBox>
          <MDBox mb={2}>
            <PasswordField
              label="Password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </MDButton>
          </MDBox>
          <MDBox mt={2} textAlign="center">
            <MDTypography
              variant="button"
              color="info"
              sx={{ cursor: "pointer" }}
              onClick={() => navigate("/authentication/forgot-password")}
            >
              Forgot password?
            </MDTypography>
          </MDBox>
        </MDBox>
      </Card>
    </CoverLayout>
  );
}

export default SignIn;

import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import CoverLayout from "examples/LayoutContainers/CoverLayout";
import bgImage from "assets/images/bg-sign-in-basic.jpeg";
import apiClient from "lib/api";
import { useAuth } from "context/AuthContext";

function PrivacyConsent() {
  const [policy, setPolicy] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { markConsentAccepted, logout } = useAuth();

  const loadPolicy = () => {
    let mounted = true;

    setLoading(true);
    setError("");
    apiClient
      .get("/privacy/consent")
      .then((data) => {
        if (!mounted) return;
        if (!data?.policy) {
          throw new Error("Privacy agreement is not configured.");
        }
        setPolicy(data.policy);
        if (!data.required) {
          markConsentAccepted();
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  };

  useEffect(() => {
    const cleanup = loadPolicy();
    return cleanup;
  }, []);

  const handleAccept = async () => {
    setSaving(true);
    setError("");

    try {
      await apiClient.post("/privacy/consent", {});
      markConsentAccepted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderList = (items) => {
    const safeItems = Array.isArray(items) ? items : [];

    if (safeItems.length === 0) {
      return (
        <MDTypography variant="body2" color="text" mb={1}>
          Details are currently unavailable. Please contact the system administrator.
        </MDTypography>
      );
    }

    return safeItems.map((item) => (
      <MDTypography key={item} variant="body2" color="text" mb={1}>
        - {item}
      </MDTypography>
    ));
  };

  return (
    <CoverLayout image={bgImage}>
      <Card sx={{ maxWidth: 760 }}>
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
            Privacy Notice
          </MDTypography>
          {policy && (
            <MDTypography variant="button" color="white">
              Agreement version {policy.version}
            </MDTypography>
          )}
        </MDBox>
        <MDBox pt={4} pb={3} px={3}>
          {loading ? (
            <MDTypography variant="body2" color="text">
              Loading privacy agreement...
            </MDTypography>
          ) : error && !policy ? (
            <>
              <MDTypography variant="body2" color="error" mb={2}>
                {error}
              </MDTypography>
              <MDTypography variant="body2" color="text">
                Please try again. If it keeps happening, contact the system administrator so the
                privacy agreement can be checked.
              </MDTypography>
              <MDBox display="flex" gap={2} mt={3}>
                <MDButton variant="gradient" color="info" onClick={loadPolicy}>
                  Retry
                </MDButton>
                <MDButton variant="outlined" color="secondary" onClick={logout}>
                  Sign Out
                </MDButton>
              </MDBox>
            </>
          ) : (
            <>
              {policy && (
                <MDBox maxHeight="58vh" overflow="auto" pr={1}>
                  <MDTypography variant="h5" color="dark" mb={1}>
                    {policy.title}
                  </MDTypography>
                  <MDTypography variant="body2" color="text" mb={2}>
                    {policy.summary}
                  </MDTypography>

                  <MDTypography variant="h6" color="dark" mb={1}>
                    What we collect
                  </MDTypography>
                  {renderList(policy.dataCollected)}

                  <Divider />

                  <MDTypography variant="h6" color="dark" mt={2} mb={1}>
                    How we use it
                  </MDTypography>
                  {renderList(policy.uses)}

                  <Divider />

                  <MDTypography variant="h6" color="dark" mt={2} mb={1}>
                    User agreement
                  </MDTypography>
                  {renderList(policy.agreement)}

                  <MDTypography variant="body2" color="text" mt={2}>
                    {policy.retention}
                  </MDTypography>
                  <MDTypography variant="body2" color="text" mt={1}>
                    {policy.contact}
                  </MDTypography>
                </MDBox>
              )}

              <MDBox display="flex" alignItems="flex-start" mt={3}>
                <Checkbox
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <MDTypography variant="body2" color="text" mt={1}>
                  I have read and agree to this privacy notice and user agreement.
                </MDTypography>
              </MDBox>

              {error && (
                <MDTypography variant="caption" color="error" display="block" mt={1}>
                  {error}
                </MDTypography>
              )}

              <MDBox display="flex" gap={2} mt={3}>
                <MDButton
                  variant="gradient"
                  color="info"
                  onClick={handleAccept}
                  disabled={!accepted || saving || !policy}
                >
                  {saving ? "Saving..." : "Accept and Continue"}
                </MDButton>
                <MDButton variant="outlined" color="secondary" onClick={logout} disabled={saving}>
                  Sign Out
                </MDButton>
              </MDBox>
            </>
          )}
        </MDBox>
      </Card>
    </CoverLayout>
  );
}

export default PrivacyConsent;

import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";

import CertificatePreviewModal from "components/CertificatePreviewModal";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { LearnerHero, LearningArt } from "components/DashboardIdentity";
import { useAppPalette } from "lib/appTheme";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function LearnerCertificates() {
  const { user, isLearner } = useAuth();
  const palette = useAppPalette();
  const [certificates, setCertificates] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewCertificateId, setPreviewCertificateId] = useState(null);

  useEffect(() => {
    const loadCertificates = async () => {
      setLoading(true);
      setError("");
      try {
        const [response, badgeResponse] = await Promise.all([
          apiClient.get("/certificates"),
          apiClient.get("/courses/learner/badges").catch(() => []),
        ]);
        setCertificates(response);
        setBadges(badgeResponse);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (isLearner() && user?.email) {
      loadCertificates();
    }
  }, [user?.email]);

  if (!isLearner()) {
    return <MDBox p={2}>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Certificates & Badges"
        subtitle="Your approved certificates and badges from every term. Preview or download them anytime."
      />
      <MDBox py={3}>
        <LearnerHero
          eyebrow="YOU EARNED THIS"
          title="Your wall of wonderful."
          description="Big effort deserves a little celebration. Collect your badges and look back at everything you’ve achieved."
          art="trophy"
        >
          <Chip label={`${badges.length} badges`} sx={{ bgcolor: palette.chipSurface }} />
          <Chip label={`${certificates.length} certificates`} sx={{ bgcolor: "#fff5cd" }} />
        </LearnerHero>
        <Card>
          <MDBox p={2}>
            <MDTypography variant="h6" fontWeight="bold">
              Learning Badges
            </MDTypography>
            <MDBox mt={1.5} display="flex" gap={1} flexWrap="wrap">
              {badges.length ? (
                badges.map((badge) => (
                  <MDBox
                    key={badge.id}
                    sx={{
                      width: { xs: "calc(50% - 8px)", sm: 170 },
                      p: 2,
                      textAlign: "center",
                      background: palette.dark
                        ? palette.surfaceMuted
                        : "linear-gradient(#faf6ff,#fffaf0)",
                      border: `1px solid ${palette.border}`,
                      borderRadius: "17px",
                    }}
                  >
                    <LearningArt kind="trophy" size={90} />
                    <MDTypography variant="button" fontWeight="bold" display="block">
                      {badge.badge_name || badge.module_title}
                    </MDTypography>
                    <MDTypography variant="caption" color="text" display="block">
                      {badge.course_name}
                    </MDTypography>
                    <Chip
                      size="small"
                      label={badge.label}
                      sx={{ mt: 1, bgcolor: palette.accentSoft, color: palette.accentText }}
                    />
                  </MDBox>
                ))
              ) : (
                <MDTypography variant="body2" color="text">
                  Complete a course module or typing assessment to earn your first badge.
                </MDTypography>
              )}
            </MDBox>
          </MDBox>
        </Card>
        <Card sx={{ mt: 2 }}>
          <MDBox p={2.5}>
            <MDTypography variant="h6" mb={2}>
              My Certificates
            </MDTypography>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}
            {loading ? (
              <MDTypography variant="body2">Loading certificates...</MDTypography>
            ) : certificates.length === 0 ? (
              <MDTypography variant="body2" color="text">
                Your first certificate is waiting at the end of a course. Keep learning!
              </MDTypography>
            ) : (
              <MDBox
                display="grid"
                gridTemplateColumns={{
                  xs: "1fr",
                  sm: "repeat(2,minmax(0,1fr))",
                  xl: "repeat(3,minmax(0,1fr))",
                }}
                gap={2}
              >
                {certificates.map((certificate) => (
                  <MDBox
                    key={certificate.id}
                    p={2.5}
                    sx={{
                      border: `1px solid ${palette.border}`,
                      borderRadius: "17px",
                      textAlign: "center",
                      background: palette.dark
                        ? palette.surfaceMuted
                        : "linear-gradient(135deg,#fffdf5,#f4efff)",
                    }}
                  >
                    <LearningArt kind="trophy" size={110} />
                    <MDTypography
                      variant="caption"
                      sx={{ color: "#916629", letterSpacing: ".14em", fontWeight: 700 }}
                    >
                      CERTIFICATE OF ACHIEVEMENT
                    </MDTypography>
                    <MDTypography variant="h6" mt={1}>
                      {certificate.course_name}
                    </MDTypography>
                    <MDTypography variant="caption" color="text" display="block" mt={1}>
                      {[certificate.term, certificate.academic_year].filter(Boolean).join(" · ")}
                    </MDTypography>
                    <Chip label={certificate.status} color="info" size="small" sx={{ my: 2 }} />
                    <MDButton
                      color="info"
                      variant="contained"
                      fullWidth
                      onClick={() => setPreviewCertificateId(certificate.id)}
                    >
                      View Certificate
                    </MDButton>
                  </MDBox>
                ))}
              </MDBox>
            )}
          </MDBox>
        </Card>
      </MDBox>
      <CertificatePreviewModal
        open={Boolean(previewCertificateId)}
        certificateId={previewCertificateId}
        onClose={() => setPreviewCertificateId(null)}
      />
      <Footer />
    </DashboardLayout>
  );
}

export default LearnerCertificates;

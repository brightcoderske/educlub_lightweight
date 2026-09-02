import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import CertificatePreviewModal from "components/CertificatePreviewModal";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

function SchoolAdminCertificates() {
  const { user, isSchoolAdmin } = useAuth();
  const cacheKey = `school-admin:${user?.schoolId}:certificates`;
  const cachedCertificates = getCachedPage(cacheKey)?.value;
  const [certificates, setCertificates] = useState(cachedCertificates || []);
  const [loading, setLoading] = useState(!cachedCertificates);
  const [error, setError] = useState("");
  const [previewCertificateId, setPreviewCertificateId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const loadCertificates = async (background = false) => {
    const cached = getCachedPage(cacheKey)?.value;
    if (cached && !background) {
      setCertificates(cached);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const response = await apiClient.get(`/certificates?school_id=${user?.schoolId}`);
      setCertificates(response);
      setCachedPage(cacheKey, response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSchoolAdmin() && user?.schoolId) {
      loadCertificates();
    }
  }, [user?.schoolId]);

  const approveCertificate = async (id) => {
    setApprovingId(id);
    setError("");
    try {
      const approved = await apiClient.put(`/certificates/${id}/approve`, {});
      setCertificates((current) => {
        const next = current.map((certificate) =>
          certificate.id === id ? { ...certificate, ...approved, status: "approved" } : certificate
        );
        setCachedPage(cacheKey, next);
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  if (!isSchoolAdmin()) {
    return <MDBox p={2}>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Certificates"
        subtitle="Course completion creates a certificate for school approval. Approved certificates stay available to learners across terms."
      />
      <MDBox py={2}>
        <Card>
          <MDBox p={2}>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}
            {loading ? (
              <MDTypography variant="body2">Loading certificates...</MDTypography>
            ) : certificates.length === 0 ? (
              <MDTypography variant="body2" color="text">
                No certificates are waiting for this school yet.
              </MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Learner</TableCell>
                      <TableCell>Course</TableCell>
                      <TableCell>Term</TableCell>
                      <TableCell>Academic Year</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {certificates.map((certificate) => (
                      <TableRow key={certificate.id}>
                        <TableCell>{certificate.learner_name}</TableCell>
                        <TableCell>{certificate.course_name}</TableCell>
                        <TableCell>{certificate.term || "-"}</TableCell>
                        <TableCell>{certificate.academic_year || "-"}</TableCell>
                        <TableCell>
                          <Chip label={certificate.status} color="info" size="small" />
                        </TableCell>
                        <TableCell align="center">
                          <MDBox display="flex" justifyContent="center" gap={1} flexWrap="wrap">
                            <MDButton
                              variant="text"
                              color="info"
                              size="small"
                              onClick={() => setPreviewCertificateId(certificate.id)}
                            >
                              Preview
                            </MDButton>
                            <MDButton
                              variant="text"
                              color="success"
                              size="small"
                              disabled={
                                Boolean(approvingId) ||
                                ["approved", "issued"].includes(certificate.status)
                              }
                              onClick={() => approveCertificate(certificate.id)}
                            >
                              {approvingId === certificate.id ? "Approving..." : "Approve"}
                            </MDButton>
                          </MDBox>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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

export default SchoolAdminCertificates;

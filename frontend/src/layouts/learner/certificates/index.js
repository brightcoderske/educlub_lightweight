import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function LearnerCertificates() {
  const { user, isLearner } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCertificates = async () => {
      setLoading(true);
      setError("");
      try {
        const learners = await apiClient.get(`/learners?email=${encodeURIComponent(user?.email)}`);
        const learner = learners[0];
        if (!learner) {
          setCertificates([]);
          return;
        }
        const response = await apiClient.get(`/certificates?learner_id=${learner.id}`);
        setCertificates(response);
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
    return <MDBox p={3}>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="My Certificates"
            subtitle="Certificates approved by your school will appear here."
          />
        </MDBox>
        <Card>
          <MDBox p={3}>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}
            {loading ? (
              <MDTypography variant="body2">Loading certificates...</MDTypography>
            ) : certificates.length === 0 ? (
              <MDTypography variant="body2" color="text">
                No certificates yet.
              </MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Course</TableCell>
                      <TableCell>Term</TableCell>
                      <TableCell>Academic Year</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {certificates.map((certificate) => (
                      <TableRow key={certificate.id}>
                        <TableCell>{certificate.course_name}</TableCell>
                        <TableCell>{certificate.term || "-"}</TableCell>
                        <TableCell>{certificate.academic_year || "-"}</TableCell>
                        <TableCell>
                          <Chip label={certificate.status} color="info" size="small" />
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
      <Footer />
    </DashboardLayout>
  );
}

export default LearnerCertificates;

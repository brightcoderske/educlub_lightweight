import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Autocomplete from "@mui/material/Autocomplete";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";

function SystemAdminReports() {
  const { isSystemAdmin } = useAuth();
  const [schools, setSchools] = useState([]);
  const [learners, setLearners] = useState([]);
  const [school, setSchool] = useState(null);
  const [learner, setLearner] = useState(null);
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSystemAdmin()) return;
    Promise.all([
      apiClient.get("/schools"),
      apiClient.get("/learners"),
      apiClient.get("/academic/terms/current").catch(() => null),
    ])
      .then(([schoolsRes, learnersRes, activeTerm]) => {
        setSchools(schoolsRes);
        setLearners(learnersRes);
        if (activeTerm?.name) {
          setTerm(activeTerm.name);
          setAcademicYear(
            activeTerm.academic_year || new Date(activeTerm.start_date || Date.now()).getFullYear()
          );
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const downloadBlob = async (url, options, fileName) => {
    setError("");
    setMessage("");
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        ...(options?.headers || {}),
      },
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Could not generate report.");
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(objectUrl);
  };

  const generateLearner = async () => {
    if (!learner) {
      setError("Select a learner first.");
      return;
    }
    try {
      await downloadBlob(
        `${API_BASE_URL}/reports/pdf/${learner.id}/${term}/${academicYear}`,
        { method: "GET" },
        `report-${learner.full_name}-${term}-${academicYear}.pdf`
      );
      setMessage("Learner report generated.");
    } catch (err) {
      setError(err.message);
    }
  };

  const generateSchool = async () => {
    if (!school) {
      setError("Select a school first.");
      return;
    }
    try {
      await downloadBlob(
        `${API_BASE_URL}/reports/pdf/school`,
        {
          method: "POST",
          body: JSON.stringify({ school_id: school.id, term, academicYear }),
        },
        `school-reports-${school.code || school.id}-${term}-${academicYear}.zip`
      );
      setMessage("School report pack generated.");
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isSystemAdmin()) {
    return <MDBox p={3}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Reports"
        subtitle="Generate report cards for a single learner or a full school."
      />
      <MDBox py={2}>
        <Card>
          <MDBox p={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={learners}
                  getOptionLabel={(option) => `${option.full_name} (${option.school_name})`}
                  value={learner}
                  onChange={(_, value) => setLearner(value)}
                  renderInput={(params) => <MDInput {...params} label="Learner" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={schools}
                  getOptionLabel={(option) => `${option.name} (${option.code})`}
                  value={school}
                  onChange={(_, value) => setSchool(value)}
                  renderInput={(params) => <MDInput {...params} label="School" />}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <MDInput
                  label="Term"
                  fullWidth
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <MDInput
                  label="Year"
                  type="number"
                  fullWidth
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </Grid>
            </Grid>
            {message && (
              <MDTypography variant="caption" color="success" display="block" mt={2}>
                {message}
              </MDTypography>
            )}
            {error && (
              <MDTypography variant="caption" color="error" display="block" mt={2}>
                {error}
              </MDTypography>
            )}
            <MDBox mt={3} display="flex" gap={1} flexWrap="wrap">
              <MDButton variant="gradient" color="info" onClick={generateLearner}>
                Generate Learner Report
              </MDButton>
              <MDButton variant="outlined" color="info" onClick={generateSchool}>
                Generate Whole School Reports
              </MDButton>
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminReports;

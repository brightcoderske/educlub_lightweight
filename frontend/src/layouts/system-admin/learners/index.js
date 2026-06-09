import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Autocomplete from "@mui/material/Autocomplete";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import LearnerDetailModal from "components/LearnerDetailModal";

const emptyForm = {
  school: null,
  first_name: "",
  second_name: "",
  third_name: "",
};

function SystemAdminLearners() {
  const { isSystemAdmin } = useAuth();
  const [schools, setSchools] = useState([]);
  const [learners, setLearners] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [schoolsRes, learnersRes] = await Promise.all([
        apiClient.get("/schools"),
        apiClient.get("/learners"),
      ]);
      setSchools(schoolsRes);
      setLearners(learnersRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSystemAdmin()) loadData();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiClient.post("/learners", {
        school_id: form.school?.id,
        first_name: form.first_name,
        second_name: form.second_name,
        third_name: form.third_name,
      });
      setMessage(`Learner created. Username: ${result.username}`);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetLearnerByEmail = async (learner) => {
    if (!learner.user_id) {
      setError("Learner login account is not linked yet.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const result = await apiClient.put(`/users/${learner.user_id}/reset-password-email`, {});
      setMessage(result.message || "Password reset email sent.");
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isSystemAdmin()) {
    return <MDBox p={3}>Access denied. System Admin only.</MDBox>;
  }

  const filteredLearners = learners.filter((learner) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      learner.full_name?.toLowerCase().includes(query) ||
      learner.username?.toLowerCase().includes(query) ||
      learner.email?.toLowerCase().includes(query);
    const matchesSchool = !schoolFilter || learner.school_id === schoolFilter.id;

    return matchesSearch && matchesSchool;
  });

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <MDTypography variant="h3">Learners</MDTypography>
          <MDTypography variant="body2" color="text">
            Register learner accounts with school and name only. School Admins can complete the
            profile later.
          </MDTypography>
        </MDBox>

        <Card>
          <MDBox p={3}>
            <MDTypography variant="h5" mb={2}>
              Register Learner
            </MDTypography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={schools}
                  getOptionLabel={(option) => `${option.name} (${option.code})`}
                  value={form.school}
                  onChange={(_, value) => setForm((current) => ({ ...current, school: value }))}
                  renderInput={(params) => <MDInput {...params} label="School" />}
                />
              </Grid>
              {[
                ["first_name", "First Name"],
                ["second_name", "Second Name"],
                ["third_name", "Third Name"],
              ].map(([name, label]) => (
                <Grid item xs={12} md={name === "third_name" ? 12 : 6} key={name}>
                  <MDInput
                    label={label}
                    fullWidth
                    value={form[name]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [name]: event.target.value }))
                    }
                  />
                </Grid>
              ))}
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
            <MDBox mt={3}>
              <MDButton
                variant="gradient"
                color="info"
                onClick={handleCreate}
                disabled={saving || !form.school || !form.first_name || !form.second_name}
              >
                {saving ? "Registering..." : "Register Learner"}
              </MDButton>
            </MDBox>
          </MDBox>
        </Card>

        <Card sx={{ mt: 3 }}>
          <MDBox p={3}>
            <MDTypography variant="h5" mb={2}>
              Learner Accounts
            </MDTypography>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Search learner, username, or email"
                  fullWidth
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={schools}
                  getOptionLabel={(option) => `${option.name} (${option.code})`}
                  value={schoolFilter}
                  onChange={(_, value) => setSchoolFilter(value)}
                  renderInput={(params) => <MDInput {...params} label="Filter by school" />}
                />
              </Grid>
            </Grid>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              Showing {filteredLearners.length} of {learners.length} learners
            </MDTypography>
            {loading ? (
              <MDTypography variant="body2">Loading...</MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Learner</TableCell>
                      <TableCell>Username</TableCell>
                      <TableCell>School</TableCell>
                      <TableCell>Grade</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell align="center">Password</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLearners.map((learner) => (
                      <TableRow key={learner.id}>
                        <TableCell>
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => setSelectedLearnerId(learner.id)}
                          >
                            {learner.full_name}
                          </MDButton>
                        </TableCell>
                        <TableCell>{learner.username || "-"}</TableCell>
                        <TableCell>{learner.school_name}</TableCell>
                        <TableCell>{learner.grade || "-"}</TableCell>
                        <TableCell>{learner.stream || "-"}</TableCell>
                        <TableCell align="center">
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => resetLearnerByEmail(learner)}
                          >
                            Email Reset
                          </MDButton>
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
      <LearnerDetailModal
        open={Boolean(selectedLearnerId)}
        learnerId={selectedLearnerId}
        onClose={() => setSelectedLearnerId(null)}
      />
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminLearners;

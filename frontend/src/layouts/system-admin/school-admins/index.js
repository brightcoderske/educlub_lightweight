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

const emptyForm = {
  school: null,
  full_name: "",
  email: "",
  phone: "",
};

function SystemAdminSchoolAdmins() {
  const { isSystemAdmin } = useAuth();
  const [schools, setSchools] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [schoolsRes, adminsRes] = await Promise.all([
        apiClient.get("/schools"),
        apiClient.get("/users?role=school_admin"),
      ]);
      setSchools(schoolsRes);
      setAdmins(adminsRes);
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
      await apiClient.post("/users/school-admins", {
        school_id: form.school?.id,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
      });
      setMessage("School Admin created. Login details have been emailed.");
      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (admin) => {
    setEditingId(admin.id);
    setForm({
      school: schools.find((school) => school.id === admin.school_id) || null,
      full_name: admin.full_name || "",
      email: admin.email || "",
      phone: admin.phone || "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.put(`/users/${editingId}`, {
        school_id: form.school?.id,
        full_name: form.full_name,
        email: form.email,
        username: form.email?.toLowerCase(),
        is_active: true,
      });
      setMessage("School Admin updated.");
      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAdmin = async (adminId) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.delete(`/users/${adminId}`);
      setMessage("School Admin account deleted.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetAdminPassword = async (adminId) => {
    setError("");
    setMessage("");
    try {
      const result = await apiClient.put(`/users/${adminId}/reset-password-email`, {});
      setMessage(result.message || "Password reset email sent.");
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isSystemAdmin()) {
    return <MDBox p={3}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <MDTypography variant="h3">School Admins</MDTypography>
          <MDTypography variant="body2" color="text">
            Add school administrators and send first-login credentials automatically.
          </MDTypography>
        </MDBox>

        <Card>
          <MDBox p={3}>
            <MDTypography variant="h5" mb={2}>
              Register School Admin
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
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Full Name"
                  fullWidth
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Email"
                  type="email"
                  fullWidth
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Contact"
                  fullWidth
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
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
            <MDBox mt={3}>
              <MDButton
                variant="gradient"
                color="info"
                onClick={editingId ? handleSave : handleCreate}
                disabled={saving || !form.school || !form.full_name || !form.email}
              >
                {saving ? "Saving..." : editingId ? "Save School Admin" : "Create School Admin"}
              </MDButton>
              {editingId ? (
                <MDButton
                  variant="text"
                  color="secondary"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  sx={{ ml: 1 }}
                >
                  Cancel
                </MDButton>
              ) : null}
            </MDBox>
          </MDBox>
        </Card>

        <Card sx={{ mt: 3 }}>
          <MDBox p={3}>
            <MDTypography variant="h5" mb={2}>
              Admin Accounts
            </MDTypography>
            {loading ? (
              <MDTypography variant="body2">Loading...</MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>School</TableCell>
                      <TableCell>First Login Reset</TableCell>
                      <TableCell align="center">Password</TableCell>
                      <TableCell align="center">Manage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {admins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>{admin.full_name}</TableCell>
                        <TableCell>{admin.email}</TableCell>
                        <TableCell>{admin.school_name || "-"}</TableCell>
                        <TableCell>{admin.force_password_reset ? "Yes" : "No"}</TableCell>
                        <TableCell align="center">
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => resetAdminPassword(admin.id)}
                          >
                            Email Reset
                          </MDButton>
                        </TableCell>
                        <TableCell align="center">
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => startEdit(admin)}
                          >
                            Edit
                          </MDButton>
                          <MDButton
                            variant="text"
                            color="error"
                            size="small"
                            disabled={saving}
                            onClick={() => deleteAdmin(admin.id)}
                          >
                            Delete
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
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminSchoolAdmins;

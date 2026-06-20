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
import { getCachedPage, setCachedPage } from "lib/pageCache";

const emptyForm = {
  school: null,
  role: "school_admin",
  full_name: "",
  email: "",
  phone: "",
};

const CACHE_KEY = "system-admin:school-staff";

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

  const loadData = async (background = false) => {
    const cached = getCachedPage(CACHE_KEY)?.value;
    if (cached && !background) {
      setSchools(cached.schools || []);
      setAdmins(cached.admins || []);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const [schoolsRes, adminsRes, teachersRes] = await Promise.all([
        apiClient.get("/schools"),
        apiClient.get("/users?role=school_admin"),
        apiClient.get("/users?role=teacher"),
      ]);
      const nextAdmins = [...adminsRes, ...teachersRes].sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );
      setSchools(schoolsRes);
      setAdmins(nextAdmins);
      setCachedPage(CACHE_KEY, { schools: schoolsRes, admins: nextAdmins });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSystemAdmin()) loadData(Boolean(getCachedPage(CACHE_KEY)));
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.post("/users/staff", {
        school_id: form.school?.id,
        role: form.role,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
      });
      setMessage(
        `${
          form.role === "teacher" ? "Teacher" : "School Admin"
        } created. Login details have been emailed.`
      );
      setForm(emptyForm);
      setEditingId(null);
      await loadData(true);
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
      role: admin.role,
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
      await loadData(true);
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
      setAdmins((current) => current.filter((admin) => admin.id !== adminId));
      setMessage("School Admin account deleted.");
      loadData(true);
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
          <MDTypography variant="h3">School Staff</MDTypography>
          <MDTypography variant="body2" color="text">
            Create school administrators or teachers and send first-login credentials.
          </MDTypography>
        </MDBox>

        <Card>
          <MDBox p={3}>
            <MDTypography variant="h5" mb={2}>
              Register Staff Account
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
                <Autocomplete
                  options={[
                    { value: "school_admin", label: "School Admin" },
                    { value: "teacher", label: "Teacher" },
                  ]}
                  getOptionLabel={(option) => option.label}
                  value={
                    [
                      { value: "school_admin", label: "School Admin" },
                      { value: "teacher", label: "Teacher" },
                    ].find((option) => option.value === form.role) || null
                  }
                  disabled={Boolean(editingId)}
                  onChange={(_, value) =>
                    setForm((current) => ({
                      ...current,
                      role: value?.value || "school_admin",
                    }))
                  }
                  renderInput={(params) => <MDInput {...params} label="Role" />}
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
                {saving ? "Saving..." : editingId ? "Save Staff Account" : "Create Staff Account"}
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
              Staff Accounts
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
                      <TableCell>Role</TableCell>
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
                        <TableCell>
                          {admin.role === "teacher" ? "Teacher" : "School Admin"}
                        </TableCell>
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

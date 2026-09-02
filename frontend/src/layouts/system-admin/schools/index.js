import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";
import { getCachedPage, setCachedPage } from "lib/pageCache";

const emptyForm = {
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
  logo_url: "",
};

const CACHE_KEY = "system-admin:schools";

function cleanText(value) {
  if (typeof value !== "string") return "";
  if (
    value.includes("System.Management.Automation.PSMethod") ||
    value.includes("OverloadDefinitions") ||
    value.includes("MemberType")
  ) {
    return "";
  }
  return value;
}

function SystemAdminSchools() {
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolLearners, setSchoolLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSchools = async (background = false) => {
    const cached = getCachedPage(CACHE_KEY)?.value;
    if (cached && !background) {
      setSchools(cached);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const response = await apiClient.get("/schools");
      setSchools(response);
      setCachedPage(CACHE_KEY, response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const uploadLogo = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await apiClient.post("/schools/logo", {
          fileName: file.name,
          dataUrl: reader.result,
        });
        setForm((current) => ({ ...current, logo_url: result.logo_url }));
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const createSchool = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.post("/schools", form);
      setForm(emptyForm);
      setEditingId(null);
      await loadSchools(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSchool = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.put(`/schools/${editingId}`, form);
      setForm(emptyForm);
      setEditingId(null);
      await loadSchools(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (school) => {
    setEditingId(school.id);
    setForm({
      name: school.name || "",
      code: school.code || "",
      email: cleanText(school.email),
      phone: cleanText(school.phone),
      address: cleanText(school.address),
      logo_url: cleanText(school.logo_url),
    });
  };

  const openLearners = async (school) => {
    setSelectedSchool(school);
    setSchoolLearners(await apiClient.get(`/schools/${school.id}/learners`));
  };

  const exportLearners = async (school) => {
    const response = await fetch(`${API_BASE_URL}/schools/${school.id}/learners/export`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Could not export learners.");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${school.code || "school"}-learners.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Schools"
        subtitle="Register schools and upload their logo for reports and dashboards."
      />
      <MDBox py={2}>
        <Card>
          <MDBox p={2}>
            <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
              Register School
            </MDTypography>
            <Grid container spacing={2}>
              {[
                ["name", "School Name"],
                ["code", "School Code"],
                ["email", "School Email"],
                ["phone", "School Contact"],
                ["address", "School Address / Location"],
              ].map(([name, label]) => (
                <Grid item xs={12} md={name === "address" ? 12 : 6} key={name}>
                  <MDInput
                    label={label}
                    fullWidth
                    value={form[name]}
                    onChange={(event) => setForm({ ...form, [name]: event.target.value })}
                  />
                </Grid>
              ))}
              <Grid item xs={12} md={6}>
                <MDButton variant="outlined" color="info" component="label" fullWidth>
                  Upload School Logo
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => uploadLogo(event.target.files?.[0])}
                  />
                </MDButton>
              </Grid>
              <Grid item xs={12} md={6}>
                <MDTypography variant="caption" color={form.logo_url ? "success" : "text"}>
                  {form.logo_url
                    ? "Logo uploaded and ready."
                    : "PNG or JPG logo. It will be used in reports."}
                </MDTypography>
              </Grid>
            </Grid>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mt={2}>
                {error}
              </MDTypography>
            )}
            <MDBox mt={3}>
              <MDButton
                variant="gradient"
                color="info"
                disabled={saving || !form.name || !form.code}
                onClick={editingId ? saveSchool : createSchool}
              >
                {saving ? "Saving..." : editingId ? "Save School" : "Register School"}
              </MDButton>
              {editingId ? (
                <MDButton
                  variant="text"
                  color="secondary"
                  sx={{ ml: 1 }}
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </MDButton>
              ) : null}
            </MDBox>
          </MDBox>
        </Card>

        <Card sx={{ mt: 3 }}>
          <MDBox p={2}>
            <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
              Registered Schools
            </MDTypography>
            {loading ? (
              <MDTypography variant="body2">Loading...</MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Logo</TableCell>
                      <TableCell>School</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Learners</TableCell>
                      <TableCell align="center">Manage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {schools.map((school) => (
                      <TableRow key={school.id}>
                        <TableCell>
                          {school.logo_url ? (
                            <MDBox
                              component="img"
                              src={school.logo_url}
                              alt={school.name}
                              width="42px"
                              height="42px"
                              borderRadius="8px"
                              sx={{ objectFit: "contain" }}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{school.name}</TableCell>
                        <TableCell>{school.code}</TableCell>
                        <TableCell>{school.email || "-"}</TableCell>
                        <TableCell>{school.phone || "-"}</TableCell>
                        <TableCell>
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => openLearners(school)}
                          >
                            {school.learners_count || 0}
                          </MDButton>
                        </TableCell>
                        <TableCell align="center">
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => startEdit(school)}
                          >
                            Edit
                          </MDButton>
                          <MDButton
                            variant="text"
                            color="success"
                            size="small"
                            onClick={() => exportLearners(school)}
                          >
                            Export
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
      <Dialog
        open={Boolean(selectedSchool)}
        onClose={() => setSelectedSchool(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{selectedSchool?.name} Learners</DialogTitle>
        <DialogContent>
          {schoolLearners.length === 0 ? (
            <MDTypography variant="body2" color="text">
              No learners registered in this school.
            </MDTypography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Grade</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Term</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schoolLearners.map((learner) => (
                    <TableRow key={learner.id}>
                      <TableCell>{learner.full_name}</TableCell>
                      <TableCell>{learner.username || "-"}</TableCell>
                      <TableCell>{learner.grade || "-"}</TableCell>
                      <TableCell>{learner.stream || "-"}</TableCell>
                      <TableCell>{learner.term || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminSchools;

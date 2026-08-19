import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
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

const emptyYear = {
  year: "",
  start_date: "",
  end_date: "",
  is_active: "false",
};

const emptyTerm = {
  academic_year_id: "",
  name: "Term 1",
  term_type: "regular",
  start_date: "",
  end_date: "",
  is_active: "false",
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

function yearToForm(year) {
  return {
    year: year?.year || "",
    start_date: toDateInput(year?.start_date),
    end_date: toDateInput(year?.end_date),
    is_active: year?.is_active ? "true" : "false",
  };
}

function termToForm(term) {
  return {
    academic_year_id: term?.academic_year_id || "",
    name: term?.name || "Term 1",
    term_type: term?.term_type || "regular",
    start_date: toDateInput(term?.start_date),
    end_date: toDateInput(term?.end_date),
    is_active: term?.is_active ? "true" : "false",
  };
}

function SystemAdminAcademic() {
  const { isSystemAdmin } = useAuth();
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [yearForm, setYearForm] = useState(emptyYear);
  const [termForm, setTermForm] = useState(emptyTerm);
  const [editingYearId, setEditingYearId] = useState(null);
  const [editingTermId, setEditingTermId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const activeYear = useMemo(() => years.find((year) => year.is_active) || years[0], [years]);
  const termsByYear = useMemo(
    () =>
      terms.reduce((groups, term) => {
        const key = term.academic_year || "No year";
        return {
          ...groups,
          [key]: [...(groups[key] || []), term],
        };
      }, {}),
    [terms]
  );

  const loadAcademic = async () => {
    const [yearsResponse, termsResponse] = await Promise.all([
      apiClient.get("/academic/years"),
      apiClient.get("/academic/terms"),
    ]);
    setYears(yearsResponse);
    setTerms(termsResponse);
    if (!termForm.academic_year_id && yearsResponse[0]?.id) {
      setTermForm((current) => ({
        ...current,
        academic_year_id: activeYear?.id || yearsResponse[0].id,
      }));
    }
  };

  useEffect(() => {
    if (isSystemAdmin()) {
      loadAcademic().catch((err) => setError(err.message));
    }
  }, []);

  const resetYearForm = () => {
    setEditingYearId(null);
    setYearForm(emptyYear);
  };

  const resetTermForm = () => {
    setEditingTermId(null);
    setTermForm({
      ...emptyTerm,
      academic_year_id: activeYear?.id || years[0]?.id || "",
    });
  };

  const saveYear = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        year: Number(yearForm.year),
        start_date: yearForm.start_date,
        end_date: yearForm.end_date,
        is_active: yearForm.is_active === "true",
      };
      if (editingYearId) {
        await apiClient.put(`/academic/years/${editingYearId}`, payload);
        setMessage("Academic year updated.");
      } else {
        await apiClient.post("/academic/years", payload);
        setMessage("Academic year created.");
      }
      resetYearForm();
      await loadAcademic();
    } catch (err) {
      setError(err.message || "Failed to save academic year.");
    } finally {
      setSaving(false);
    }
  };

  const saveTerm = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        academic_year_id: Number(termForm.academic_year_id),
        name: termForm.name,
        term_type: termForm.term_type,
        start_date: termForm.start_date,
        end_date: termForm.end_date,
        is_active: termForm.is_active === "true",
      };
      if (editingTermId) {
        await apiClient.put(`/academic/terms/${editingTermId}`, payload);
        setMessage("Term updated and weeks recalculated.");
      } else {
        await apiClient.post("/academic/terms", payload);
        setMessage("Term created and weeks calculated.");
      }
      resetTermForm();
      await loadAcademic();
    } catch (err) {
      setError(err.message || "Failed to save term.");
    } finally {
      setSaving(false);
    }
  };

  const deleteYear = async (year) => {
    if (!window.confirm(`Delete academic year ${year.year}? Linked terms will also be removed.`)) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiClient.delete(`/academic/years/${year.id}`);
      await loadAcademic();
    } catch (err) {
      setError(err.message || "Failed to delete academic year.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTerm = async (term) => {
    if (!window.confirm(`Delete ${term.term_label || `${term.academic_year} - ${term.name}`}?`)) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiClient.delete(`/academic/terms/${term.id}`);
      await loadAcademic();
    } catch (err) {
      setError(err.message || "Failed to delete term.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSystemAdmin()) {
    return <MDBox p={2}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <MDTypography variant="h3">Academic Years & Terms</MDTypography>
          <MDTypography variant="body2" color="text">
            Edit dates, active records, and week calculation from one system-admin screen.
          </MDTypography>
        </MDBox>

        {error && (
          <MDBox mb={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#fee2e2" }}>
            <MDTypography variant="body2" color="error">
              {error}
            </MDTypography>
          </MDBox>
        )}
        {message && (
          <MDBox mb={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#dcfce7" }}>
            <MDTypography variant="body2" color="success">
              {message}
            </MDTypography>
          </MDBox>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} lg={5}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                  {editingYearId ? "Edit Academic Year" : "Create Academic Year"}
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      label="Year"
                      type="number"
                      fullWidth
                      value={yearForm.year}
                      onChange={(event) => setYearForm({ ...yearForm, year: event.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={yearForm.start_date}
                      onChange={(event) =>
                        setYearForm({ ...yearForm, start_date: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={yearForm.end_date}
                      onChange={(event) =>
                        setYearForm({ ...yearForm, end_date: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Active year"
                      fullWidth
                      value={yearForm.is_active}
                      onChange={(event) =>
                        setYearForm({ ...yearForm, is_active: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </MDInput>
                  </Grid>
                </Grid>
                <MDBox mt={2} display="flex" gap={1}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    disabled={
                      saving || !yearForm.year || !yearForm.start_date || !yearForm.end_date
                    }
                    onClick={saveYear}
                  >
                    {editingYearId ? "Save Year" : "Create Year"}
                  </MDButton>
                  {editingYearId && (
                    <MDButton variant="outlined" color="dark" onClick={resetYearForm}>
                      Cancel
                    </MDButton>
                  )}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                  {editingTermId ? "Edit Term" : "Create Term"}
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Academic year"
                      fullWidth
                      value={termForm.academic_year_id}
                      onChange={(event) =>
                        setTermForm({ ...termForm, academic_year_id: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="">Select year</option>
                      {years.map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.year}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Term"
                      fullWidth
                      value={termForm.name}
                      onChange={(event) => setTermForm({ ...termForm, name: event.target.value })}
                      SelectProps={{ native: true }}
                    >
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Type"
                      fullWidth
                      value={termForm.term_type}
                      onChange={(event) =>
                        setTermForm({ ...termForm, term_type: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="regular">Regular</option>
                      <option value="crash_course">Crash course</option>
                      <option value="holiday_program">Holiday program</option>
                      <option value="intensive">Intensive</option>
                      <option value="other">Other</option>
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={termForm.start_date}
                      onChange={(event) =>
                        setTermForm({ ...termForm, start_date: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={termForm.end_date}
                      onChange={(event) =>
                        setTermForm({ ...termForm, end_date: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Active term"
                      fullWidth
                      value={termForm.is_active}
                      onChange={(event) =>
                        setTermForm({ ...termForm, is_active: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </MDInput>
                  </Grid>
                </Grid>
                <MDBox mt={2} display="flex" gap={1}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    disabled={
                      saving ||
                      !termForm.academic_year_id ||
                      !termForm.name ||
                      !termForm.start_date ||
                      !termForm.end_date
                    }
                    onClick={saveTerm}
                  >
                    {editingTermId ? "Save Term" : "Create Term"}
                  </MDButton>
                  {editingTermId && (
                    <MDButton variant="outlined" color="dark" onClick={resetTermForm}>
                      Cancel
                    </MDButton>
                  )}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                  Academic Years
                </MDTypography>
                <TableContainer>
                  <Table>
                    <TableHead sx={{ display: "table-header-group" }}>
                      <TableRow>
                        <TableCell>Year</TableCell>
                        <TableCell>Dates</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {years.map((year) => (
                        <TableRow key={year.id}>
                          <TableCell>{year.year}</TableCell>
                          <TableCell>
                            {toDateInput(year.start_date)} to {toDateInput(year.end_date)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={year.is_active ? "Active" : "Inactive"}
                              color={year.is_active ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingYearId(year.id);
                                setYearForm(yearToForm(year));
                              }}
                            >
                              <Icon>edit</Icon>
                            </IconButton>
                            <IconButton size="small" onClick={() => deleteYear(year)}>
                              <Icon>delete</Icon>
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                  Terms
                </MDTypography>
                {Object.entries(termsByYear).map(([year, rows]) => (
                  <MDBox key={year} mb={2}>
                    <MDTypography variant="button" fontWeight="bold">
                      {year}
                    </MDTypography>
                    <TableContainer>
                      <Table>
                        <TableHead sx={{ display: "table-header-group" }}>
                          <TableRow>
                            <TableCell>Term</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Dates</TableCell>
                            <TableCell>Weeks</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((term) => (
                            <TableRow key={term.id}>
                              <TableCell>
                                {term.term_label || `${term.academic_year} - ${term.name}`}
                              </TableCell>
                              <TableCell>{term.term_type}</TableCell>
                              <TableCell>
                                {toDateInput(term.start_date)} to {toDateInput(term.end_date)}
                              </TableCell>
                              <TableCell>{term.total_weeks || "-"}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={term.is_active ? "Active" : "Inactive"}
                                  color={term.is_active ? "success" : "default"}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingTermId(term.id);
                                    setTermForm(termToForm(term));
                                  }}
                                >
                                  <Icon>edit</Icon>
                                </IconButton>
                                <IconButton size="small" onClick={() => deleteTerm(term)}>
                                  <Icon>delete</Icon>
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </MDBox>
                ))}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminAcademic;

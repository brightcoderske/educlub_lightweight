import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import readXlsxFile from "read-excel-file";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import LearnerDetailModal from "components/LearnerDetailModal";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";
import { getCachedPage, setCachedPage } from "lib/pageCache";

// No term or academic year here on purpose: the Add Learner form does not ask
// for them, so the backend resolves the active term rather than this form
// silently stamping every new learner with a hardcoded "Term 1".
const emptyForm = {
  first_name: "",
  second_name: "",
  third_name: "",
  grade: "",
  stream: "",
};

function SchoolAdminLearners() {
  const { user, isSchoolAdmin } = useAuth();
  const [learners, setLearners] = useState([]);
  const [school, setSchool] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [promotion, setPromotion] = useState({
    learner_id: "",
    grade: "",
    stream: "",
    next_grade: "",
    next_term: "",
    academic_year: new Date().getFullYear(),
  });
  // Which of the roster forms is open as a dialog: "add", "upload",
  // "graduate", or null for none. The table owns the full width otherwise.
  const [openForm, setOpenForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [graduationCandidate, setGraduationCandidate] = useState(null);
  const [academicTerms, setAcademicTerms] = useState([]);

  const cacheKey = `school-admin:${user?.schoolId}:learners`;

  const loadLearners = async (background = false) => {
    const cached = getCachedPage(cacheKey)?.value;
    if (cached && !background) {
      setLearners(cached.learners || []);
      setSchool(cached.school || null);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const [response, schoolRes, termsRes] = await Promise.all([
        apiClient.get(`/learners?school_id=${user?.schoolId}`),
        apiClient.get(`/schools/${user?.schoolId}`),
        apiClient.get("/academic/terms").catch(() => []),
      ]);
      setLearners(response);
      setSchool(schoolRes);
      setAcademicTerms(Array.isArray(termsRes) ? termsRes : []);
      setCachedPage(cacheKey, { learners: response, school: schoolRes });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const graduateLearner = async () => {
    if (!graduationCandidate) return;
    setSaving(true);
    setError("");
    try {
      await apiClient.put(`/learners/${graduationCandidate.id}/graduate`, {});
      setGraduationCandidate(null);
      await loadLearners(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isSchoolAdmin() && user?.schoolId) {
      loadLearners(Boolean(getCachedPage(cacheKey)));
    }
  }, [user?.schoolId]);

  const handleChange = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const grades = school?.grades_config?.length
    ? school.grades_config
    : Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);
  const learnerStreams = Array.from(
    new Set(learners.map((learner) => learner.stream).filter(Boolean))
  );
  const streams = school?.streams_config?.length ? school.streams_config : learnerStreams;
  // Terms and academic years are owned by the Academic module. Nothing here may
  // invent them: offering a term that was never created writes an orphan term
  // string onto learner and allocation records.
  const terms = academicTerms.map((item) => item.name);
  const academicYears = [
    ...new Set(academicTerms.map((item) => item.academic_year).filter(Boolean)),
  ].sort();

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.post("/learners", form);
      setForm(emptyForm);
      await loadLearners(true);
      setOpenForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...promotion,
        learner_ids: promotion.learner_id ? [Number(promotion.learner_id)] : undefined,
      };
      delete payload.learner_id;
      await apiClient.post("/learners/promote", payload);
      await loadLearners(true);
      setOpenForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetLearnerPassword = async (learnerId, temporaryPassword = "") => {
    setError("");
    try {
      const result = await apiClient.put(`/learners/${learnerId}/reset-password`, {
        temporary_password: temporaryPassword,
      });
      const message = result.temporaryPassword
        ? `${result.message} Temporary password: ${result.temporaryPassword}`
        : result.message;
      setImportMessage(message);
      return message;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const parseLearnerFile = async (file) => {
    setError("");
    setImportMessage("");
    if (!file) return;
    try {
      let rows = [];

      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const [headerLine, ...dataLines] = text.split(/\r?\n/).filter(Boolean);
        const headers = headerLine.split(",").map((header) => header.trim());
        rows = dataLines.map((line) => {
          const values = line.split(",").map((value) => value.trim());
          return headers.reduce((record, header, index) => {
            record[header] = values[index] || "";
            return record;
          }, {});
        });
      } else {
        const sheetRows = await readXlsxFile(file);
        const [headers, ...dataRows] = sheetRows;
        rows = dataRows.map((row) =>
          headers.reduce((record, header, index) => {
            record[header] = row[index] || "";
            return record;
          }, {})
        );
      }

      const normalized = rows.map((row) => ({
        first_name: row.first_name || row["1st name"] || row["First Name"] || row.firstname,
        second_name: row.second_name || row["2nd name"] || row["Second Name"] || row.secondname,
        third_name: row.third_name || row["3rd name"] || row["Third Name"] || row.thirdname,
        grade: row.grade || row.Grade,
        stream: row.stream || row.Stream || row.class || row.Class,
      }));

      const result = await apiClient.post("/learners/bulk", { learners: normalized });
      setImportMessage(
        `${result.message}${
          result.errors?.length ? ` ${result.errors.length} rows need review.` : ""
        }`
      );
      await loadLearners(true);
    } catch (err) {
      setError(
        err.message ||
          "Upload failed. Use CSV or Excel with columns: first_name, second_name, third_name, grade, stream."
      );
    }
  };

  const filteredLearners = learners.filter((learner) => {
    const matchesSearch = learner.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesGrade = !gradeFilter || learner.grade === gradeFilter;
    const matchesStream = !streamFilter || learner.stream === streamFilter;
    return matchesSearch && matchesGrade && matchesStream;
  });
  const visibleLearners = filteredLearners.slice(0, 20);

  const downloadCredentialCards = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/learners/credentials/cards?school_id=${user?.schoolId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not download learner cards");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "learner-login-cards.pdf";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isSchoolAdmin()) {
    return <MDBox p={2}>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox
          mb={2}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
        >
          <DashboardIdentity
            user={user}
            title="Learners"
            subtitle="Add learners and keep your school roster ready for course allocation."
          />
          <MDBox display="flex" gap={1} flexWrap="wrap">
            <MDButton variant="gradient" color="info" onClick={() => setOpenForm("add")}>
              <Icon>person_add</Icon>&nbsp;Add Learner
            </MDButton>
            <MDButton variant="outlined" color="info" onClick={() => setOpenForm("upload")}>
              <Icon>upload_file</Icon>&nbsp;Bulk Upload
            </MDButton>
            <MDButton variant="outlined" color="success" onClick={() => setOpenForm("graduate")}>
              <Icon>school</Icon>&nbsp;Bulk Graduate
            </MDButton>
          </MDBox>
        </MDBox>

        <Grid container spacing={3}>
          {/* Dialogs portal out of the grid, so they take no layout space here. */}
          <>
            <Dialog
              open={openForm === "add"}
              onClose={() => setOpenForm(null)}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>Add Learner</DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={2}>
                  {[
                    ["first_name", "First Name"],
                    ["second_name", "Second Name"],
                    ["third_name", "Third Name"],
                  ].map(([name, label]) => (
                    <Grid item xs={12} key={name}>
                      <MDInput
                        label={label}
                        fullWidth
                        type={name === "academic_year" ? "number" : "text"}
                        value={form[name]}
                        onChange={(event) => handleChange(name, event.target.value)}
                      />
                    </Grid>
                  ))}
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Grade"
                      fullWidth
                      value={form.grade}
                      onChange={(event) => handleChange("grade", event.target.value)}
                      SelectProps={{ native: true }}
                    >
                      <option value="" />
                      {grades.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Class / Stream"
                      fullWidth
                      value={form.stream}
                      onChange={(event) => handleChange("stream", event.target.value)}
                      SelectProps={{ native: true }}
                    >
                      <option value="" />
                      {streams.map((stream) => (
                        <option key={stream} value={stream}>
                          {stream}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                </Grid>
                {error && (
                  <MDTypography variant="caption" color="error" display="block" mt={2}>
                    {error}
                  </MDTypography>
                )}
              </DialogContent>
              <DialogActions>
                <MDButton variant="text" color="secondary" onClick={() => setOpenForm(null)}>
                  Cancel
                </MDButton>
                <MDButton
                  variant="gradient"
                  color="info"
                  onClick={handleCreate}
                  disabled={saving || !form.first_name || !form.second_name}
                >
                  {saving ? "Saving..." : "Add Learner"}
                </MDButton>
              </DialogActions>
            </Dialog>

            <Dialog
              open={openForm === "upload"}
              onClose={() => setOpenForm(null)}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>Bulk Upload</DialogTitle>
              <DialogContent dividers>
                <MDTypography variant="caption" color="text" display="block" mb={2}>
                  Upload CSV or Excel with columns: first_name, second_name, third_name, grade,
                  stream. First and second names are required.
                </MDTypography>
                <MDButton variant="outlined" color="info" component="label" fullWidth>
                  Upload Learners File
                  <input
                    hidden
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(event) => parseLearnerFile(event.target.files?.[0])}
                  />
                </MDButton>
                {importMessage && (
                  <MDTypography variant="caption" color="success" display="block" mt={2}>
                    {importMessage}
                  </MDTypography>
                )}
              </DialogContent>
              <DialogActions>
                <MDButton variant="text" color="info" onClick={downloadCredentialCards}>
                  Download Learner Login Cards
                </MDButton>
                <MDButton variant="text" color="secondary" onClick={() => setOpenForm(null)}>
                  Close
                </MDButton>
              </DialogActions>
            </Dialog>

            <Dialog
              open={openForm === "graduate"}
              onClose={() => setOpenForm(null)}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>Bulk Graduate</DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Specific Learner (optional)"
                      fullWidth
                      value={promotion.learner_id}
                      onChange={(event) =>
                        setPromotion((current) => ({ ...current, learner_id: event.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ native: true }}
                      helperText="Leave empty to match learners by grade and stream."
                    >
                      <option value="">All learners matching grade / stream</option>
                      {learners.map((learner) => (
                        <option key={learner.id} value={learner.id}>
                          {learner.full_name} - {learner.grade || "No grade"}{" "}
                          {learner.stream ? `(${learner.stream})` : ""}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Current Grade"
                      fullWidth
                      value={promotion.grade}
                      onChange={(event) =>
                        setPromotion((current) => ({ ...current, grade: event.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ native: true }}
                      disabled={Boolean(promotion.learner_id)}
                      helperText="Used only when no specific learner is selected."
                    >
                      <option value="">Any grade</option>
                      {grades.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Class / Stream"
                      fullWidth
                      value={promotion.stream}
                      onChange={(event) =>
                        setPromotion((current) => ({ ...current, stream: event.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ native: true }}
                      disabled={Boolean(promotion.learner_id)}
                      helperText="Optional class filter."
                    >
                      <option value="">Any stream</option>
                      {streams.map((stream) => (
                        <option key={stream} value={stream}>
                          {stream}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Next Grade"
                      fullWidth
                      value={promotion.next_grade}
                      onChange={(event) =>
                        setPromotion((current) => ({
                          ...current,
                          next_grade: event.target.value,
                        }))
                      }
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ native: true }}
                      helperText="Leave empty if only changing term."
                    >
                      <option value="">Keep current grade</option>
                      {grades.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Next Term"
                      fullWidth
                      value={promotion.next_term}
                      onChange={(event) =>
                        setPromotion((current) => ({ ...current, next_term: event.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ native: true }}
                      helperText="Leave empty if only changing grade."
                    >
                      <option value="">Keep current term</option>
                      {terms.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Academic Year"
                      fullWidth
                      value={promotion.academic_year}
                      onChange={(event) =>
                        setPromotion((current) => ({
                          ...current,
                          academic_year: event.target.value,
                        }))
                      }
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ native: true }}
                      helperText="Target academic year."
                    >
                      {academicYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <MDButton variant="text" color="secondary" onClick={() => setOpenForm(null)}>
                  Cancel
                </MDButton>
                <MDButton
                  variant="gradient"
                  color="success"
                  onClick={handlePromote}
                  disabled={saving || (!promotion.next_grade && !promotion.next_term)}
                >
                  Graduate Learners
                </MDButton>
              </DialogActions>
            </Dialog>
          </>

          <Grid item xs={12}>
            <Card>
              <MDBox p={2}>
                {/* Title, count, filters and refresh share a single toolbar row
                    so the table starts as high up the card as possible. */}
                <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1.5}>
                  <MDTypography variant="button" fontWeight="medium">
                    School Learners
                  </MDTypography>
                  <MDTypography variant="caption" color="text">
                    {visibleLearners.length}/{filteredLearners.length}
                  </MDTypography>
                  <MDBox flexGrow={1} />
                  <MDInput
                    size="small"
                    label="Search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    sx={{ width: { xs: "100%", sm: 190 } }}
                  />
                  <MDInput
                    size="small"
                    select
                    label="Grade"
                    value={gradeFilter}
                    onChange={(event) => setGradeFilter(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    SelectProps={{ native: true }}
                    sx={{ width: { xs: "100%", sm: 120 } }}
                  >
                    <option value="" />
                    {grades.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </MDInput>
                  <MDInput
                    size="small"
                    select
                    label="Class"
                    value={streamFilter}
                    onChange={(event) => setStreamFilter(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    SelectProps={{ native: true }}
                    sx={{ width: { xs: "100%", sm: 120 } }}
                  >
                    <option value="" />
                    {streams.map((stream) => (
                      <option key={stream} value={stream}>
                        {stream}
                      </option>
                    ))}
                  </MDInput>
                  <Tooltip title="Refresh">
                    <IconButton size="small" color="info" onClick={loadLearners}>
                      <Icon fontSize="small">refresh</Icon>
                    </IconButton>
                  </Tooltip>
                </MDBox>
                {loading ? (
                  <MDTypography variant="body2">Loading learners...</MDTypography>
                ) : learners.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No learners registered yet.
                  </MDTypography>
                ) : (
                  <TableContainer sx={{ maxHeight: 560 }}>
                    <Table
                      size="small"
                      sx={{
                        "& .MuiTableCell-root": {
                          fontSize: "0.75rem",
                          lineHeight: 1.3,
                          whiteSpace: "nowrap",
                        },
                      }}
                    >
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Username</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Grade</TableCell>
                          <TableCell>Class</TableCell>
                          <TableCell>Term</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Account</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleLearners.map((learner) => (
                          <TableRow key={learner.id}>
                            <TableCell>
                              {/* Plain clickable text: a button here adds its own
                                  padding and drives the whole row height up. */}
                              <MDTypography
                                variant="button"
                                fontWeight="medium"
                                color="info"
                                sx={{ cursor: "pointer", fontSize: "0.75rem" }}
                                onClick={() => setSelectedLearnerId(learner.id)}
                              >
                                {learner.full_name}
                              </MDTypography>
                            </TableCell>
                            <TableCell>{learner.username || "-"}</TableCell>
                            <TableCell>{learner.email || "-"}</TableCell>
                            <TableCell>{learner.grade || "-"}</TableCell>
                            <TableCell>{learner.stream || "-"}</TableCell>
                            <TableCell>{learner.term || "-"}</TableCell>
                            <TableCell>
                              {learner.graduation_status === "graduated" ? "Graduated" : "Active"}
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Manage learner">
                                <IconButton
                                  size="small"
                                  color="info"
                                  onClick={() => setSelectedLearnerId(learner.id)}
                                >
                                  <Icon fontSize="small">manage_accounts</Icon>
                                </IconButton>
                              </Tooltip>
                              {learner.graduation_status !== "graduated" && (
                                <Tooltip title="Graduate learner">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => setGraduationCandidate(learner)}
                                  >
                                    <Icon fontSize="small">school</Icon>
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <LearnerDetailModal
        open={Boolean(selectedLearnerId)}
        learnerId={selectedLearnerId}
        onClose={() => setSelectedLearnerId(null)}
        onResetPassword={resetLearnerPassword}
      />
      <Dialog
        open={Boolean(graduationCandidate)}
        onClose={() => setGraduationCandidate(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Graduate learner</DialogTitle>
        <DialogContent>
          <MDTypography variant="body2">
            Mark {graduationCandidate?.full_name} as graduated? Their learning history and reports
            will remain available.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton color="dark" variant="text" onClick={() => setGraduationCandidate(null)}>
            Cancel
          </MDButton>
          <MDButton color="success" disabled={saving} onClick={graduateLearner}>
            Graduate
          </MDButton>
        </DialogActions>
      </Dialog>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolAdminLearners;

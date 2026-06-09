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

const emptyForm = {
  first_name: "",
  second_name: "",
  third_name: "",
  grade: "",
  stream: "",
  term: "Term 1",
  academic_year: new Date().getFullYear(),
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);

  const loadLearners = async () => {
    setLoading(true);
    setError("");
    try {
      const [response, schoolRes] = await Promise.all([
        apiClient.get(`/learners?school_id=${user?.schoolId}`),
        apiClient.get(`/schools/${user?.schoolId}`),
      ]);
      setLearners(response);
      setSchool(schoolRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSchoolAdmin() && user?.schoolId) {
      loadLearners();
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
  const terms = ["Term 1", "Term 2", "Term 3"];
  const academicYears = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() + index);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.post("/learners", form);
      setForm(emptyForm);
      await loadLearners();
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
      await loadLearners();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetLearnerPassword = async (learnerId) => {
    setError("");
    try {
      const result = await apiClient.put(`/learners/${learnerId}/reset-password`, {});
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
      await loadLearners();
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
    return <MDBox p={3}>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="Learners"
            subtitle="Add learners and keep your school roster ready for course allocation."
          />
        </MDBox>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={4}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Add Learner
                </MDTypography>
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
                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    fullWidth
                    onClick={handleCreate}
                    disabled={saving || !form.first_name || !form.second_name}
                  >
                    {saving ? "Saving..." : "Add Learner"}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
            <Card sx={{ mt: 3 }}>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={1}>
                  Bulk Upload
                </MDTypography>
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
                <MDBox mt={2}>
                  <MDButton variant="text" color="info" onClick={downloadCredentialCards}>
                    Download Learner Login Cards
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
            <Card sx={{ mt: 3 }}>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Bulk Graduate
                </MDTypography>
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
                      SelectProps={{ native: true }}
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
                      SelectProps={{ native: true }}
                      disabled={Boolean(promotion.learner_id)}
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
                      SelectProps={{ native: true }}
                      disabled={Boolean(promotion.learner_id)}
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
                      SelectProps={{ native: true }}
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
                      SelectProps={{ native: true }}
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
                      SelectProps={{ native: true }}
                    >
                      {academicYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                </Grid>
                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="success"
                    fullWidth
                    onClick={handlePromote}
                    disabled={saving || (!promotion.next_grade && !promotion.next_term)}
                  >
                    Graduate Learners
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <MDBox>
                    <MDTypography variant="h5">School Learners</MDTypography>
                    <MDTypography variant="caption" color="text">
                      Showing {visibleLearners.length} of {filteredLearners.length} matching
                      learners
                    </MDTypography>
                  </MDBox>
                  <MDButton variant="text" color="info" onClick={loadLearners}>
                    <Icon>refresh</Icon>&nbsp;Refresh
                  </MDButton>
                </MDBox>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      label="Search by learner name"
                      fullWidth
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDInput
                      select
                      label="Grade"
                      fullWidth
                      value={gradeFilter}
                      onChange={(event) => setGradeFilter(event.target.value)}
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
                  <Grid item xs={12} md={3}>
                    <MDInput
                      select
                      label="Class"
                      fullWidth
                      value={streamFilter}
                      onChange={(event) => setStreamFilter(event.target.value)}
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
                {loading ? (
                  <MDTypography variant="body2">Loading learners...</MDTypography>
                ) : learners.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No learners registered yet.
                  </MDTypography>
                ) : (
                  <TableContainer sx={{ maxHeight: 560 }}>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Username</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Grade</TableCell>
                          <TableCell>Class</TableCell>
                          <TableCell>Term</TableCell>
                          <TableCell align="center">Account</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleLearners.map((learner) => (
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
                            <TableCell>{learner.email || "-"}</TableCell>
                            <TableCell>{learner.grade || "-"}</TableCell>
                            <TableCell>{learner.stream || "-"}</TableCell>
                            <TableCell>{learner.term || "-"}</TableCell>
                            <TableCell align="center">
                              <MDButton
                                variant="outlined"
                                color="info"
                                size="small"
                                onClick={() => setSelectedLearnerId(learner.id)}
                              >
                                Manage
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
          </Grid>
        </Grid>
      </MDBox>
      <LearnerDetailModal
        open={Boolean(selectedLearnerId)}
        learnerId={selectedLearnerId}
        onClose={() => setSelectedLearnerId(null)}
        onResetPassword={resetLearnerPassword}
      />
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolAdminLearners;

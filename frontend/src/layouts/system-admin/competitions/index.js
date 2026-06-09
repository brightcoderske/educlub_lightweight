import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DashboardIdentity from "components/DashboardIdentity";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

const emptyForm = {
  name: "",
  description: "",
  competition_type: "quiz",
  eligible_grades: [],
  start_date: "",
  end_date: "",
  price_amount: 0,
  currency: "KES",
  image_url: "",
  practice_available: false,
  is_featured: false,
  is_active: true,
};

const gradeOptions = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);

const competitionTypes = [
  ["quiz", "Quiz"],
  ["typing", "Typing"],
  ["maths", "Maths"],
  ["science", "Science"],
  ["stem", "STEM"],
];

function buildReportEndpoint(filters) {
  const params = new URLSearchParams();
  params.set("status", filters.status);
  params.set("sort", filters.sort);
  params.set("stage", filters.stage);
  if (filters.competitionId) params.set("competition_id", filters.competitionId);
  if (filters.grade) params.set("grade", filters.grade);
  if (filters.type) params.set("type", filters.type);
  return `/competitions/report?${params.toString()}`;
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
      ? "rd"
      : "th";
  const month = date.toLocaleString("en-US", { month: "long" });
  return `${month} ${day}${suffix}, ${date.getFullYear()}`;
}

function formatDateRange(startDate, endDate) {
  return `${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
}

function bannerUploadStatus(uploading, imageUrl) {
  if (uploading) {
    return "Uploading banner...";
  }

  if (imageUrl) {
    return "Banner uploaded and ready.";
  }

  return "Upload a PNG or JPG banner for learner adverts.";
}

function bannerThumbnail(imageUrl, altText) {
  if (!imageUrl) {
    return (
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="100%"
        height="120px"
        borderRadius="lg"
        bgColor="grey-100"
        border="1px dashed #cbd5e1"
      >
        <MDTypography variant="caption" color="text">
          No banner uploaded
        </MDTypography>
      </MDBox>
    );
  }

  return (
    <MDBox
      component="img"
      src={imageUrl}
      alt={altText}
      width="100%"
      height="120px"
      borderRadius="lg"
      sx={{ objectFit: "cover", border: "1px solid #e5e7eb" }}
    />
  );
}

function SystemAdminCompetitions() {
  const { user, isSystemAdmin } = useAuth();
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [gradePicker, setGradePicker] = useState("");
  const [reportRows, setReportRows] = useState([]);
  const [reportFilters, setReportFilters] = useState({
    competitionId: "",
    grade: "",
    sort: "desc",
    stage: "final",
    status: "available",
    type: "",
  });

  const loadCompetitions = async () => {
    setError("");
    try {
      setCompetitions(await apiClient.get("/competitions"));
    } catch (err) {
      setError(err.message || "Failed to load competitions");
    }
  };

  const loadReportRows = async () => {
    try {
      setReportRows(await apiClient.get(buildReportEndpoint(reportFilters)));
    } catch (err) {
      setError(err.message || "Failed to load competition reporting");
    }
  };

  useEffect(() => {
    if (isSystemAdmin()) {
      loadCompetitions();
      loadReportRows();
    }
  }, []);

  useEffect(() => {
    if (isSystemAdmin()) {
      loadReportRows();
    }
  }, [reportFilters]);

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const setReportFilter = (name, value) => {
    setReportFilters((current) => ({ ...current, [name]: value }));
  };

  const toggleGrade = (grade) => {
    setForm((current) => {
      const grades = current.eligible_grades || [];
      return {
        ...current,
        eligible_grades: grades.includes(grade)
          ? grades.filter((item) => item !== grade)
          : [...grades, grade].sort(
              (a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0)
            ),
      };
    });
  };

  const addSelectedGrade = (grade) => {
    if (!grade) return;
    toggleGrade(grade);
    setGradePicker("");
  };

  const saveCompetition = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let response;
      if (editingId) {
        response = await apiClient.put(`/competitions/${editingId}`, form);
      } else {
        response = await apiClient.post("/competitions", form);
      }
      setForm(emptyForm);
      setEditingId(null);
      setGradePicker("");
      setMessage(editingId ? "Competition updated." : "Competition created.");
      await loadCompetitions();
      if (response?.competition_type === "typing" || form.competition_type === "typing") {
        navigate(`/system-admin/typing-quizzes?competition_id=${response.id}`);
      } else if (response?.id) {
        navigate(`/system-admin/typing-quizzes?category=weekly_quiz&competition_id=${response.id}`);
      }
    } catch (err) {
      setError(err.message || "Could not save competition");
    } finally {
      setSaving(false);
    }
  };

  const editCompetition = (competition) => {
    setEditingId(competition.id);
    setForm({
      name: competition.name || "",
      description: competition.description || "",
      competition_type: competition.competition_type || "quiz",
      eligible_grades: Array.isArray(competition.eligible_grades)
        ? competition.eligible_grades
        : [],
      start_date: dateInputValue(competition.start_date),
      end_date: dateInputValue(competition.end_date),
      price_amount: Number(competition.price_amount || 0),
      currency: competition.currency || "KES",
      image_url: competition.image_url || "",
      practice_available: Boolean(competition.practice_available),
      is_featured: Boolean(competition.is_featured),
      is_active: competition.is_active !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setGradePicker("");
  };

  const uploadBanner = async (file) => {
    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Banner image must be 2MB or smaller.");
      return;
    }

    setUploadingBanner(true);
    setError("");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = await apiClient.post("/competitions/banner", {
            fileName: file.name,
            dataUrl: reader.result,
          });
          setField("image_url", result.image_url);
          setMessage("Banner image uploaded.");
        } catch (err) {
          setError(err.message || "Could not upload banner image");
        } finally {
          setUploadingBanner(false);
        }
      };
      reader.onerror = () => {
        setUploadingBanner(false);
        setError("Could not read banner image.");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingBanner(false);
      setError(err.message || "Could not upload banner image");
    }
  };

  const setupTypingCompetition = (competition) => {
    navigate(`/system-admin/typing-quizzes?competition_id=${competition.id}`);
  };

  const setupQuizCompetition = (competition) => {
    navigate(`/system-admin/typing-quizzes?category=weekly_quiz&competition_id=${competition.id}`);
  };

  if (!isSystemAdmin()) {
    return <MDBox p={3}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <DashboardIdentity
          user={user}
          title="Competition Manager"
          subtitle="Create learning-platform-backed competitions and monitor enrolment."
        />

        <Grid container spacing={3} mt={1}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="bold" mb={2}>
                  {editingId ? "Edit Competition" : "New Competition"}
                </MDTypography>
                <MDBox mb={2}>
                  <MDInput
                    label="Competition name"
                    fullWidth
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </MDBox>
                <MDBox mb={2}>
                  <MDInput
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                  />
                </MDBox>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      select
                      label="Competition type"
                      fullWidth
                      value={form.competition_type}
                      SelectProps={{ native: true }}
                      onChange={(e) => setField("competition_type", e.target.value)}
                    >
                      {competitionTypes.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDTypography variant="caption" color="text" display="block" mb={0.5}>
                      Eligible grades
                    </MDTypography>
                    <MDInput
                      select
                      fullWidth
                      value={gradePicker}
                      SelectProps={{ native: true }}
                      onChange={(e) => addSelectedGrade(e.target.value)}
                    >
                      <option value="">Select grade</option>
                      {gradeOptions.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </MDInput>
                    <MDBox display="flex" flexWrap="wrap" gap={0.75} mt={1}>
                      {form.eligible_grades.length ? (
                        form.eligible_grades.map((grade) => (
                          <Chip
                            key={grade}
                            label={grade}
                            color="info"
                            onDelete={() => toggleGrade(grade)}
                            size="small"
                          />
                        ))
                      ) : (
                        <MDTypography variant="caption" color="text">
                          No grades selected. Learners from all grades can view it.
                        </MDTypography>
                      )}
                    </MDBox>
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <MDInput
                      type="date"
                      label="Start"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={form.start_date}
                      onChange={(e) => setField("start_date", e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      type="date"
                      label="End"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={form.end_date}
                      onChange={(e) => setField("end_date", e.target.value)}
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2} mt={0.5}>
                  <Grid item xs={7}>
                    <MDInput
                      type="number"
                      label="Price"
                      fullWidth
                      value={form.price_amount}
                      onChange={(e) => setField("price_amount", Number(e.target.value))}
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <MDInput
                      label="Currency"
                      fullWidth
                      value={form.currency}
                      onChange={(e) => setField("currency", e.target.value.toUpperCase())}
                    />
                  </Grid>
                </Grid>
                <MDBox mt={2}>
                  {bannerThumbnail(form.image_url, `${form.name || "Competition"} banner`)}
                </MDBox>
                <MDBox mt={1.5}>
                  <MDInput
                    type="file"
                    label="Banner image"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ accept: "image/png,image/jpeg,image/jpg" }}
                    onChange={(event) => uploadBanner(event.target.files?.[0])}
                  />
                  <MDTypography
                    variant="caption"
                    color={form.image_url ? "success" : "text"}
                    display="block"
                    mt={0.5}
                  >
                    {bannerUploadStatus(uploadingBanner, form.image_url)}
                  </MDTypography>
                </MDBox>
                <MDBox display="flex" alignItems="center" mt={2}>
                  <Checkbox
                    checked={form.practice_available}
                    onChange={(e) => setField("practice_available", e.target.checked)}
                  />
                  <MDTypography variant="button" color="text">
                    Practice available
                  </MDTypography>
                </MDBox>
                <MDBox display="flex" alignItems="center">
                  <Checkbox
                    checked={form.is_featured}
                    onChange={(e) => setField("is_featured", e.target.checked)}
                  />
                  <MDTypography variant="button" color="text">
                    Featured
                  </MDTypography>
                </MDBox>
                <MDBox display="flex" alignItems="center">
                  <Checkbox
                    checked={form.is_active}
                    onChange={(e) => setField("is_active", e.target.checked)}
                  />
                  <MDTypography variant="button" color="text">
                    Active
                  </MDTypography>
                </MDBox>
                <MDButton
                  variant="gradient"
                  color="info"
                  fullWidth
                  onClick={saveCompetition}
                  disabled={
                    saving || !form.name || !form.start_date || !form.end_date || !form.image_url
                  }
                >
                  {saving ? "Saving..." : editingId ? "Update Competition" : "Create Competition"}
                </MDButton>
                {editingId && (
                  <MDButton variant="text" color="dark" fullWidth onClick={cancelEdit}>
                    Cancel Edit
                  </MDButton>
                )}
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <MDTypography variant="h5" fontWeight="bold">
                    Available Competitions
                  </MDTypography>
                  <MDBox display="flex" gap={1} flexWrap="wrap">
                    <MDButton variant="text" color="info" onClick={loadCompetitions}>
                      Refresh
                    </MDButton>
                  </MDBox>
                </MDBox>
                {message && (
                  <MDTypography variant="caption" color="success" display="block" mb={1}>
                    {message}
                  </MDTypography>
                )}
                {error && (
                  <MDTypography variant="caption" color="error" display="block" mb={1}>
                    {error}
                  </MDTypography>
                )}
                <TableContainer>
                  <Table>
                    <TableHead sx={{ display: "table-header-group" }}>
                      <TableRow>
                        <TableCell>Banner</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Grades</TableCell>
                        <TableCell>Dates</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Enrolled</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {competitions.map((competition) => (
                        <TableRow key={competition.id}>
                          <TableCell>
                            <MDBox width="88px">
                              {bannerThumbnail(
                                competition.image_url,
                                `${competition.name || "Competition"} banner`
                              )}
                            </MDBox>
                          </TableCell>
                          <TableCell>{competition.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={competition.competition_type || "quiz"}
                              color="info"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <MDBox
                              component="details"
                              sx={{ cursor: "pointer", width: "fit-content" }}
                            >
                              <MDBox component="summary" sx={{ listStyle: "none" }}>
                                <MDTypography variant="caption" color="info">
                                  {competition.eligible_grades?.length
                                    ? `${competition.eligible_grades.length} grades`
                                    : "All grades"}
                                </MDTypography>
                              </MDBox>
                              <MDBox display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                                {competition.eligible_grades?.length ? (
                                  competition.eligible_grades.map((grade) => (
                                    <Chip key={grade} label={grade} size="small" color="info" />
                                  ))
                                ) : (
                                  <Chip label="All grades" size="small" color="success" />
                                )}
                              </MDBox>
                            </MDBox>
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" color="text">
                              {formatDateRange(competition.start_date, competition.end_date)}
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            {competition.currency} {competition.price_amount}
                          </TableCell>
                          <TableCell>{competition.enrolled_count || 0}</TableCell>
                          <TableCell>
                            <MDBox display="flex" flexWrap="wrap" gap={0.25}>
                              <MDButton
                                variant="text"
                                color="info"
                                size="small"
                                onClick={() => editCompetition(competition)}
                              >
                                Edit
                              </MDButton>
                              {competition.competition_type === "typing" && (
                                <MDButton
                                  variant="text"
                                  color="warning"
                                  size="small"
                                  onClick={() => setupTypingCompetition(competition)}
                                >
                                  Typing Setup
                                </MDButton>
                              )}
                              {competition.competition_type !== "typing" && (
                                <MDButton
                                  variant="text"
                                  color="success"
                                  size="small"
                                  onClick={() => setupQuizCompetition(competition)}
                                >
                                  Quiz Setup
                                </MDButton>
                              )}
                            </MDBox>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
        <Card sx={{ mt: 3 }}>
          <MDBox p={3}>
            <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <MDTypography variant="h5" fontWeight="bold">
                Competition Reporting
              </MDTypography>
              <MDButton variant="text" color="info" onClick={loadReportRows}>
                Refresh
              </MDButton>
            </MDBox>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Competition"
                  fullWidth
                  value={reportFilters.competitionId}
                  SelectProps={{ native: true }}
                  onChange={(e) => setReportFilter("competitionId", e.target.value)}
                >
                  <option value="">All competitions</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.name}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Grade"
                  fullWidth
                  value={reportFilters.grade}
                  SelectProps={{ native: true }}
                  onChange={(e) => setReportFilter("grade", e.target.value)}
                >
                  <option value="">All grades</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Type"
                  fullWidth
                  value={reportFilters.type}
                  SelectProps={{ native: true }}
                  onChange={(e) => setReportFilter("type", e.target.value)}
                >
                  <option value="">All types</option>
                  {competitionTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Stage"
                  fullWidth
                  value={reportFilters.stage}
                  SelectProps={{ native: true }}
                  onChange={(e) => setReportFilter("stage", e.target.value)}
                >
                  <option value="final">Final</option>
                  <option value="practice">Practice</option>
                </MDInput>
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Timing"
                  fullWidth
                  value={reportFilters.status}
                  SelectProps={{ native: true }}
                  onChange={(e) => setReportFilter("status", e.target.value)}
                >
                  <option value="available">Available</option>
                  <option value="current">Current</option>
                  <option value="past">Past</option>
                </MDInput>
              </Grid>
            </Grid>
            <TableContainer>
              <Table>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Learner</TableCell>
                    <TableCell>Competition</TableCell>
                    <TableCell>Grade</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Rank</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportRows.slice(0, 25).map((row) => (
                    <TableRow key={`${row.competition_id}-${row.learner_id}-${row.id}`}>
                      <TableCell>{row.learner_name}</TableCell>
                      <TableCell>{row.competition_name}</TableCell>
                      <TableCell>{row.grade || "-"}</TableCell>
                      <TableCell>{row.result_stage || reportFilters.stage}</TableCell>
                      <TableCell>{row.total_score ?? "-"}</TableCell>
                      <TableCell>
                        {row.rank ? `#${row.rank}` : "-"}
                        {row.participant_count ? ` / ${row.participant_count}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminCompetitions;

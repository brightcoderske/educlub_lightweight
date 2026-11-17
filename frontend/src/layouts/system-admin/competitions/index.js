import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
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
import CompetitionEditor, {
  CompetitionBanner,
  competitionSetupPath,
  competitionTypes,
  gradeOptions,
} from "components/CompetitionEditor";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

const SETUP_PATH = "/system-admin/typing-quizzes";

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

function SystemAdminCompetitions() {
  const { isSystemAdmin } = useAuth();
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
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

  const setReportFilter = (name, value) => {
    setReportFilters((current) => ({ ...current, [name]: value }));
  };

  if (!isSystemAdmin()) {
    return <MDBox p={2}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Competition Manager"
        subtitle="Create learning-platform-backed competitions and monitor enrolment."
      />
      <MDBox py={2}>
        <Grid container spacing={3} mt={1}>
          <Grid item xs={12}>
            <Card>
              <CompetitionEditor
                editing={editing}
                setupPath={SETUP_PATH}
                onSaved={async () => {
                  setEditing(null);
                  await loadCompetitions();
                }}
                onCancel={() => setEditing(null)}
              />
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={2}>
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
                        <TableCell>Run by</TableCell>
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
                              <CompetitionBanner
                                imageUrl={competition.image_url}
                                altText={`${competition.name || "Competition"} banner`}
                              />
                            </MDBox>
                          </TableCell>
                          <TableCell>{competition.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={competition.school_name || "eduClub"}
                              color={competition.school_id ? "secondary" : "success"}
                              size="small"
                            />
                          </TableCell>
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
                                onClick={() => setEditing(competition)}
                              >
                                Edit
                              </MDButton>
                              {competition.competition_type === "typing" && (
                                <MDButton
                                  variant="text"
                                  color="warning"
                                  size="small"
                                  onClick={() =>
                                    navigate(competitionSetupPath(SETUP_PATH, competition))
                                  }
                                >
                                  Typing Setup
                                </MDButton>
                              )}
                              {competition.competition_type !== "typing" && (
                                <MDButton
                                  variant="text"
                                  color="success"
                                  size="small"
                                  onClick={() =>
                                    navigate(competitionSetupPath(SETUP_PATH, competition))
                                  }
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
          <MDBox p={2}>
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

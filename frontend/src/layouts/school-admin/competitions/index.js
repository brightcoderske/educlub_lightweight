import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DashboardIdentity from "components/DashboardIdentity";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

const todayValue = new Date().toISOString().slice(0, 10);
const gradeOptions = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);
const competitionTypes = [
  ["", "All types"],
  ["quiz", "Quiz"],
  ["typing", "Typing"],
  ["maths", "Maths"],
  ["science", "Science"],
  ["stem", "STEM"],
];

function formatMoney(competition) {
  const amount = Number(competition.price_amount || 0).toLocaleString();

  return `${competition.currency || "KES"} ${amount}`;
}

function competitionTiming(competition) {
  if (competition.end_date < todayValue) {
    return "Past";
  }

  if (competition.start_date <= todayValue && competition.end_date >= todayValue) {
    return "Current";
  }

  return "Available";
}

function buildReportEndpoint(filters) {
  const params = new URLSearchParams();
  params.set("status", filters.status);
  params.set("sort", filters.sort);

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.competitionId) {
    params.set("competition_id", filters.competitionId);
  }
  if (filters.grade) params.set("grade", filters.grade);
  if (filters.type) params.set("type", filters.type);
  if (filters.stage) params.set("stage", filters.stage);

  return `/competitions/school/report?${params.toString()}`;
}

function SchoolAdminCompetitions() {
  const { user, isSchoolAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    competitionId: "",
    grade: "",
    status: "available",
    sort: "desc",
    stage: "final",
    type: "",
  });
  const [error, setError] = useState("");
  const isTeacher = user?.role === "teacher";

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const loadCompetitions = async () => {
    setCompetitions(await apiClient.get("/competitions"));
  };

  const loadRows = async () => {
    setError("");
    try {
      setRows(await apiClient.get(buildReportEndpoint(filters)));
    } catch (err) {
      setError(err.message || "Failed to load competition results");
    }
  };

  useEffect(() => {
    if (isSchoolAdmin()) {
      loadCompetitions().catch((err) => {
        setError(err.message || "Failed to load competitions");
      });
    }
  }, []);

  useEffect(() => {
    if (isSchoolAdmin()) {
      loadRows();
    }
  }, [filters]);

  const filteredCompetitions = useMemo(
    () =>
      competitions.filter((competition) => {
        if (filters.status === "past") {
          return competition.end_date < todayValue;
        }

        if (filters.status === "current") {
          return competition.start_date <= todayValue && competition.end_date >= todayValue;
        }

        return competition.is_active !== false && competition.end_date >= todayValue;
      }),
    [competitions, filters.status]
  );

  if (!isSchoolAdmin()) {
    return <MDBox p={3}>Access denied. School staff only.</MDBox>;
  }

  const visibleRows = showAll ? rows : rows.slice(0, 10);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <DashboardIdentity
            user={user}
            title="Competitions"
            subtitle={
              isTeacher
                ? "Find school learners and review competition performance."
                : "Track enrolled learners and performance in monthly challenges."
            }
          />
          <MDButton variant="gradient" color="info" onClick={loadRows}>
            Refresh
          </MDButton>
        </MDBox>

        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={2}>
            {error}
          </MDTypography>
        )}

        <Card>
          <MDBox p={3}>
            <MDTypography variant="h5" fontWeight="bold" mb={2}>
              Available Competitions
            </MDTypography>
            <TableContainer>
              <Table>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Competition</TableCell>
                    <TableCell>Dates</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Grades</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Enrolled</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCompetitions.map((competition) => (
                    <TableRow key={competition.id}>
                      <TableCell>
                        <MDTypography variant="button" fontWeight="medium">
                          {competition.name}
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        {competition.start_date} to {competition.end_date}
                      </TableCell>
                      <TableCell>{competition.competition_type || "quiz"}</TableCell>
                      <TableCell>
                        {competition.eligible_grades?.length
                          ? competition.eligible_grades.join(", ")
                          : "All"}
                      </TableCell>
                      <TableCell>{formatMoney(competition)}</TableCell>
                      <TableCell>{competitionTiming(competition)}</TableCell>
                      <TableCell>{competition.enrolled_count || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </MDBox>
        </Card>

        <Card sx={{ mt: 3 }}>
          <MDBox p={3}>
            <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <MDTypography variant="h5" fontWeight="bold">
                {showAll ? "All Competition Learners" : "Top 10 Competition Learners"}
              </MDTypography>
              <MDButton variant="text" color="info" onClick={() => setShowAll((value) => !value)}>
                {showAll ? "Show Top 10" : "See All"}
              </MDButton>
            </MDBox>

            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={4}>
                <MDInput
                  label="Search learners"
                  fullWidth
                  value={filters.search}
                  onChange={(event) => setFilter("search", event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  fullWidth
                  label="Competition"
                  value={filters.competitionId}
                  SelectProps={{ native: true }}
                  onChange={(event) => setFilter("competitionId", event.target.value)}
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
                  fullWidth
                  label="Grade"
                  value={filters.grade}
                  SelectProps={{ native: true }}
                  onChange={(event) => setFilter("grade", event.target.value)}
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
                  fullWidth
                  label="Type"
                  value={filters.type}
                  SelectProps={{ native: true }}
                  onChange={(event) => setFilter("type", event.target.value)}
                >
                  {competitionTypes.map(([value, label]) => (
                    <option key={value || "all"} value={value}>
                      {label}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  fullWidth
                  label="Stage"
                  value={filters.stage}
                  SelectProps={{ native: true }}
                  onChange={(event) => setFilter("stage", event.target.value)}
                >
                  <option value="final">Final</option>
                  <option value="practice">Practice</option>
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  fullWidth
                  label="Competition timing"
                  value={filters.status}
                  SelectProps={{ native: true }}
                  onChange={(event) => setFilter("status", event.target.value)}
                >
                  <option value="available">Available</option>
                  <option value="current">Current</option>
                  <option value="past">Past</option>
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  fullWidth
                  label="Performance"
                  value={filters.sort}
                  SelectProps={{ native: true }}
                  onChange={(event) => setFilter("sort", event.target.value)}
                >
                  <option value="desc">High to low</option>
                  <option value="asc">Low to high</option>
                </MDInput>
              </Grid>
            </Grid>

            <TableContainer>
              <Table>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Learner</TableCell>
                    <TableCell>Competition</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Quiz</TableCell>
                    <TableCell>Typing</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Rank</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <MDTypography variant="button" fontWeight="medium">
                          {row.learner_name}
                        </MDTypography>
                        {row.learner_email && (
                          <MDTypography variant="caption" color="text" display="block">
                            {row.learner_email}
                          </MDTypography>
                        )}
                      </TableCell>
                      <TableCell>{row.competition_name}</TableCell>
                      <TableCell>
                        {row.grade || "-"} {row.stream || ""}
                      </TableCell>
                      <TableCell>{row.result_stage || filters.stage}</TableCell>
                      <TableCell>{row.quiz_score ?? "-"}</TableCell>
                      <TableCell>
                        {row.typing_wpm ? `${row.typing_wpm} WPM` : "-"}
                        {row.typing_accuracy ? ` / ${row.typing_accuracy}%` : ""}
                      </TableCell>
                      <TableCell>{row.total_score ?? "-"}</TableCell>
                      <TableCell>
                        {row.rank ? `#${row.rank}` : "-"}
                        {row.participant_count ? ` / ${row.participant_count}` : ""}
                      </TableCell>
                      <TableCell>{row.status}</TableCell>
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

export default SchoolAdminCompetitions;

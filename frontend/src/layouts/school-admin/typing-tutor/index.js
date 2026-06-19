import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function titleCaseTrack(value) {
  return String(value || "beginner")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusColor(status) {
  switch (status) {
    case "progressing":
      return "success";
    case "needs_support":
    case "accuracy_support":
      return "warning";
    case "started":
      return "info";
    default:
      return "default";
  }
}

function statusLabel(status) {
  switch (status) {
    case "progressing":
      return "Progressing";
    case "needs_support":
      return "Needs support";
    case "accuracy_support":
      return "Accuracy support";
    case "started":
      return "Started";
    default:
      return "Not started";
  }
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TypingTutorReport() {
  const { user, isSchoolAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canView = isSchoolAdmin() || user?.role === "teacher";
  const grades = useMemo(
    () => [...new Set(rows.map((row) => row.grade).filter(Boolean))].sort(),
    [rows]
  );
  const streams = useMemo(
    () => [...new Set(rows.map((row) => row.stream).filter(Boolean))].sort(),
    [rows]
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (grade && row.grade !== grade) return false;
        if (stream && row.stream !== stream) return false;
        if (
          q &&
          !String(row.full_name || "")
            .toLowerCase()
            .includes(q.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [rows, grade, stream, q]
  );
  const summary = useMemo(
    () => ({
      learners: filteredRows.length,
      started: filteredRows.filter((row) => row.status !== "not_started").length,
      support: filteredRows.filter((row) =>
        ["needs_support", "accuracy_support"].includes(row.status)
      ).length,
      averageWpm:
        filteredRows.length === 0
          ? 0
          : filteredRows.reduce((sum, row) => sum + Number(row.best_net_wpm || 0), 0) /
            filteredRows.length,
    }),
    [filteredRows]
  );

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await apiClient.get("/typing-practice/report"));
    } catch (err) {
      setError(err.message || "Could not load typing tutor report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadReport();
  }, [canView]);

  if (!canView) {
    return <MDBox>Access denied. Staff only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="Typing Tutor Progress"
            subtitle="Lightweight learner practice monitoring. This does not affect report cards."
          />
        </MDBox>

        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={2}>
            {error}
          </MDTypography>
        )}

        <Grid container spacing={2} mb={2}>
          {[
            ["Learners", summary.learners],
            ["Started", summary.started],
            ["Need Support", summary.support],
            ["Avg Best WPM", summary.averageWpm.toFixed(1)],
          ].map(([label, value]) => (
            <Grid item xs={6} md={3} key={label}>
              <Card>
                <MDBox p={2}>
                  <MDTypography variant="caption" color="text">
                    {label}
                  </MDTypography>
                  <MDTypography variant="h4">{value}</MDTypography>
                </MDBox>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card>
          <MDBox p={2.5}>
            <Grid container spacing={1.5} alignItems="center" mb={2}>
              <Grid item xs={12} md={3}>
                <MDInput
                  label="Search learner"
                  fullWidth
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Grade"
                  fullWidth
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="">All grades</option>
                  {grades.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Stream"
                  fullWidth
                  value={stream}
                  onChange={(event) => setStream(event.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="">All streams</option>
                  {streams.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDButton variant="outlined" color="info" fullWidth onClick={loadReport}>
                  Refresh
                </MDButton>
              </Grid>
            </Grid>

            <TableContainer>
              <Table>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Learner</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Current Path</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Best WPM</TableCell>
                    <TableCell>Accuracy</TableCell>
                    <TableCell>Last Practice</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8}>Loading typing tutor progress...</TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>No typing tutor progress found.</TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow key={row.learner_id}>
                        <TableCell>{row.full_name}</TableCell>
                        <TableCell>
                          {[row.grade, row.stream].filter(Boolean).join(" ") || "-"}
                        </TableCell>
                        <TableCell>
                          {titleCaseTrack(row.current_track)} / Level {row.current_level || 1}
                        </TableCell>
                        <TableCell>{row.completed_activities || 0}</TableCell>
                        <TableCell>{Number(row.best_net_wpm || 0).toFixed(1)}</TableCell>
                        <TableCell>{Number(row.best_accuracy || 0).toFixed(1)}%</TableCell>
                        <TableCell>{formatDate(row.last_practiced_at)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={statusColor(row.status)}
                            label={statusLabel(row.status)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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

export default TypingTutorReport;
